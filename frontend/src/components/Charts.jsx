/* ============================================================
   TELOS · chart primitives (custom SVG)
   ============================================================ */

import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';

// ---- shared utils ----
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 320 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const r = e.contentRect;
        setSize({ width: r.width, height: r.height });
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function fmtEUR(n, { compact = false, decimals = 0 } = {}) {
  if (n == null || isNaN(n)) return "·";
  if (compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + " M€";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + " k€";
  }
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + " €";
}

export function fmtPct(n, decimals = 2) {
  if (n == null || isNaN(n)) return "·";
  return (n * 100).toFixed(decimals) + " %";
}

export function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return "·";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtDate(s, opt = "short") {
  if (!s) return "·";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  if (opt === "long") return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  if (opt === "ym") return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ----- nice scale -----
export function niceScale(min, max, ticks = 5) {
  const range = max - min || 1;
  const rough = range / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let step;
  if (norm < 1.5) step = 1 * pow;
  else if (norm < 3) step = 2 * pow;
  else if (norm < 7) step = 5 * pow;
  else step = 10 * pow;
  const nMin = Math.floor(min / step) * step;
  const nMax = Math.ceil(max / step) * step;
  const out = [];
  for (let v = nMin; v <= nMax + step * 0.0001; v += step) out.push(+v.toFixed(10));
  return { min: nMin, max: nMax, ticks: out, step };
}

function pickDateTicks(dates, count = 6) {
  if (!dates.length) return [];
  const out = [];
  const step = Math.max(1, Math.floor((dates.length - 1) / (count - 1)));
  for (let i = 0; i < dates.length; i += step) out.push(i);
  if (out[out.length - 1] !== dates.length - 1) out.push(dates.length - 1);
  return out;
}

// =============================================================
// LineChart · generic, multi-series, with hover crosshair
// =============================================================
export function LineChart({
  series,
  dates,
  height = 320,
  yFormat = (v) => fmtNum(v, 0),
  showAxis = true,
  fillFirst = false,
  bands = [],
  padding = { top: 14, right: 14, bottom: 26, left: 56 },
  yMinHint,
  yMaxHint,
}) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState(null);

  const W = Math.max(width, 200);
  const H = height;
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  const allVals = series.flatMap(s => s.data).filter(v => v != null && !isNaN(v));
  for (const b of bands) {
    allVals.push(...b.lower, ...b.upper);
  }
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (yMinHint != null) yMin = Math.min(yMin, yMinHint);
  if (yMaxHint != null) yMax = Math.max(yMax, yMaxHint);
  const pad = (yMax - yMin) * 0.06;
  const scale = niceScale(yMin - pad, yMax + pad, 5);

  const xAt = i => padding.left + (dates.length <= 1 ? 0 : (i / (dates.length - 1)) * innerW);
  const yAt = v => padding.top + (1 - (v - scale.min) / (scale.max - scale.min)) * innerH;

  const xTicks = pickDateTicks(dates, 6);
  const yTicks = scale.ticks;

  function pathFor(data) {
    let p = "";
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v == null || isNaN(v)) continue;
      p += (p ? " L " : "M ") + xAt(i).toFixed(2) + " " + yAt(v).toFixed(2);
    }
    return p;
  }

  function areaPath(data) {
    let p = "";
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v == null || isNaN(v)) continue;
      p += (!started ? "M " : " L ") + xAt(i).toFixed(2) + " " + yAt(v).toFixed(2);
      started = true;
    }
    p += " L " + xAt(data.length - 1).toFixed(2) + " " + (padding.top + innerH).toFixed(2);
    p += " L " + xAt(0).toFixed(2) + " " + (padding.top + innerH).toFixed(2);
    p += " Z";
    return p;
  }

  function bandPath(lower, upper) {
    let p = "";
    for (let i = 0; i < upper.length; i++) {
      p += (i === 0 ? "M " : " L ") + xAt(i).toFixed(2) + " " + yAt(upper[i]).toFixed(2);
    }
    for (let i = lower.length - 1; i >= 0; i--) {
      p += " L " + xAt(i).toFixed(2) + " " + yAt(lower[i]).toFixed(2);
    }
    p += " Z";
    return p;
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < padding.left || x > padding.left + innerW) { setHover(null); return; }
    const ratio = (x - padding.left) / innerW;
    const i = Math.round(ratio * (dates.length - 1));
    setHover({ i, x: xAt(i), y: e.clientY - rect.top });
  }

  return (
    <div className="chart-wrap" ref={ref} style={{ height: H }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* gridlines */}
        {showAxis && yTicks.map((t, i) => (
          <g key={"yg" + i}>
            <line
              x1={padding.left}
              x2={padding.left + innerW}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--line-1)"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
          </g>
        ))}
        {/* bands */}
        {bands.map((b, i) => (
          <path
            key={"b" + i}
            d={bandPath(b.lower, b.upper)}
            fill={b.color || "oklch(0.82 0.11 78 / 0.10)"}
            stroke="none"
          />
        ))}
        {/* area fill (first series) */}
        {fillFirst && series[0] && (
          <path d={areaPath(series[0].data)} fill={series[0].fill || "url(#gradFill0)"} />
        )}
        <defs>
          <linearGradient id="gradFill0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.97 0.005 80 / 0.18)" />
            <stop offset="100%" stopColor="oklch(0.97 0.005 80 / 0)" />
          </linearGradient>
        </defs>
        {/* lines */}
        {series.map((s, i) => (
          <path
            key={"l" + i}
            d={pathFor(s.data)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width || 1.5}
            strokeDasharray={s.dashed ? "3 3" : null}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={s.opacity ?? 1}
          />
        ))}
        {/* x ticks */}
        {showAxis && xTicks.map((idx, i) => (
          <g key={"xt" + i}>
            <line
              x1={xAt(idx)} x2={xAt(idx)}
              y1={padding.top + innerH} y2={padding.top + innerH + 4}
              stroke="var(--line-2)"
            />
            <text
              x={xAt(idx)} y={padding.top + innerH + 16}
              textAnchor="middle"
              fill="var(--fg-3)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {fmtDate(dates[idx], "ym")}
            </text>
          </g>
        ))}
        {/* y ticks */}
        {showAxis && yTicks.map((t, i) => (
          <text
            key={"yt" + i}
            x={padding.left - 8}
            y={yAt(t) + 3}
            textAnchor="end"
            fill="var(--fg-3)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {yFormat(t)}
          </text>
        ))}
        {/* hover crosshair */}
        {hover && (
          <g>
            <line
              x1={hover.x} x2={hover.x}
              y1={padding.top} y2={padding.top + innerH}
              stroke="var(--line-3)"
              strokeDasharray="2 3"
            />
            {series.map((s, i) => {
              const v = s.data[hover.i];
              if (v == null || isNaN(v)) return null;
              return (
                <circle
                  key={"h" + i}
                  cx={hover.x} cy={yAt(v)} r="3"
                  fill="var(--bg-0)" stroke={s.color} strokeWidth="1.5"
                />
              );
            })}
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: padding.top - 8 }}>
          <div className="tt-date">{fmtDate(dates[hover.i], "long")}</div>
          {series.map((s, i) => {
            const v = s.data[hover.i];
            if (v == null || isNaN(v)) return null;
            return (
              <div className="tt-row" key={i}>
                <span className="tt-label">
                  <span className="swatch" style={{ background: s.color, borderTop: s.dashed ? "1.5px dashed " + s.color : null, height: s.dashed ? 0 : 2 }}></span>
                  {s.name}
                </span>
                <span className="tt-val">{s.format ? s.format(v) : yFormat(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================
// Sparkline · tiny inline chart
// =============================================================
export function Sparkline({ data, width = 80, height = 24, color = "var(--accent)", positiveColor, negativeColor }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * width);
  const ys = data.map(v => height - ((v - min) / range) * height);
  let p = "";
  for (let i = 0; i < data.length; i++) p += (i === 0 ? "M " : " L ") + xs[i].toFixed(1) + " " + ys[i].toFixed(1);
  const isUp = data[data.length - 1] >= data[0];
  const stroke = (isUp ? positiveColor : negativeColor) || color;
  return (
    <svg className="sparkline" width={width} height={height}>
      <path d={p} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// =============================================================
// Bar/scatter chart for residuals
// =============================================================
export function ResidualChart({ residuals, dates, height = 180 }) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState(null);
  const W = Math.max(width, 200);
  const H = height;
  const padding = { top: 10, right: 14, bottom: 26, left: 56 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  const absMax = Math.max(...residuals.map(Math.abs));
  const scale = niceScale(-absMax * 1.1, absMax * 1.1, 4);
  const xAt = i => padding.left + (i / (residuals.length - 1)) * innerW;
  const yAt = v => padding.top + (1 - (v - scale.min) / (scale.max - scale.min)) * innerH;
  const xTicks = pickDateTicks(dates, 6);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < padding.left || x > padding.left + innerW) { setHover(null); return; }
    const ratio = (x - padding.left) / innerW;
    const i = Math.round(ratio * (residuals.length - 1));
    setHover({ i, x: xAt(i) });
  }

  // sample residuals as small bars
  const step = Math.max(1, Math.floor(residuals.length / 220));
  const samples = [];
  for (let i = 0; i < residuals.length; i += step) samples.push(i);

  return (
    <div className="chart-wrap" ref={ref} style={{ height: H }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* gridlines */}
        {scale.ticks.map((t, i) => (
          <line
            key={i}
            x1={padding.left} x2={padding.left + innerW}
            y1={yAt(t)} y2={yAt(t)}
            stroke="var(--line-1)" shapeRendering="crispEdges"
          />
        ))}
        {/* zero line */}
        <line x1={padding.left} x2={padding.left + innerW} y1={yAt(0)} y2={yAt(0)} stroke="var(--line-3)" />
        {/* residual bars */}
        {samples.map(i => {
          const v = residuals[i];
          return (
            <line
              key={i}
              x1={xAt(i)} x2={xAt(i)}
              y1={yAt(0)} y2={yAt(v)}
              stroke={v >= 0 ? "oklch(0.78 0.13 150 / 0.55)" : "oklch(0.72 0.16 28 / 0.55)"}
              strokeWidth="1"
            />
          );
        })}
        {/* x ticks */}
        {xTicks.map((idx, i) => (
          <text
            key={i}
            x={xAt(idx)} y={padding.top + innerH + 16}
            textAnchor="middle" fill="var(--fg-3)" fontSize="10" fontFamily="var(--font-mono)"
          >
            {fmtDate(dates[idx], "ym")}
          </text>
        ))}
        {/* y ticks */}
        {scale.ticks.map((t, i) => (
          <text
            key={"yt" + i}
            x={padding.left - 8} y={yAt(t) + 3}
            textAnchor="end" fill="var(--fg-3)" fontSize="10" fontFamily="var(--font-mono)"
          >
            {t >= 0 ? "+" : ""}{t.toFixed(0)}
          </text>
        ))}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padding.top} y2={padding.top + innerH} stroke="var(--line-3)" strokeDasharray="2 3" />
            <circle cx={hover.x} cy={yAt(residuals[hover.i])} r="3" fill="var(--bg-0)" stroke={residuals[hover.i] >= 0 ? "var(--pos)" : "var(--neg)"} strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: 0 }}>
          <div className="tt-date">{fmtDate(dates[hover.i], "long")}</div>
          <div className="tt-row">
            <span className="tt-label">Résidu</span>
            <span className="tt-val" style={{ color: residuals[hover.i] >= 0 ? "var(--pos)" : "var(--neg)" }}>
              {residuals[hover.i] >= 0 ? "+" : ""}{residuals[hover.i].toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// expose globally
// (kept for legacy standalone preview; harmless in ES modules)
if (typeof window !== 'undefined') {
  Object.assign(window, { LineChart, Sparkline, ResidualChart, fmtEUR, fmtPct, fmtNum, fmtDate, useElementSize, niceScale });
}
