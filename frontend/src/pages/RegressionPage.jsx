/* ============================================================
   TELOS · RegressionPage
   Remplace : Regression.jsx
   Route : /regression
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { ResidualChart, fmtNum, fmtDate, useElementSize, niceScale } from '../components/Charts.jsx';
import * as api from '../api/index.js';

function pickDateTicks(dates, count = 7) {
  if (!dates.length) return [];
  const out = [];
  const step = Math.max(1, Math.floor((dates.length - 1) / (count - 1)));
  for (let i = 0; i < dates.length; i += step) out.push(i);
  if (out[out.length - 1] !== dates.length - 1) out.push(dates.length - 1);
  return out;
}

export default function RegressionPage() {
  const [etfs, setEtfs] = useState([]);
  const [ticker, setTicker] = useState('CW8');
  const [fenetre, setFenetre] = useState(10);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showProjection, setShowProjection] = useState(true);
  const [showCI, setShowCI] = useState(true);

  // Multi-ETF comparison (max 3)
  const [compareTickers, setCompareTickers] = useState([]);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    api.listeETF()
      .then(r => {
        const list = Array.isArray(r) ? r : [];
        setEtfs(list);
        const def = list.find(e => e.ticker === 'CW8') || list[0];
        if (def) setTicker(def.ticker);
      })
      .catch(e => setError(e.message));
  }, []);

  const etf = etfs.find(e => e.ticker === ticker);

  async function run() {
    if (!ticker) return;
    setRunning(true);
    setError(null);
    try {
      const r = await api.lancerRegression({ ticker, fenetreAnnees: fenetre });
      setResult(r);
      if (compareTickers.length > 0) {
        const allTickers = [ticker, ...compareTickers];
        const comp = await api.comparerRegressions(fenetre, allTickers);
        setComparison(comp);
      } else {
        setComparison(null);
      }
    } catch (e) {
      setError(e.message || 'Erreur API');
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (ticker && etf && !result) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, etf]);

  function fmtPVal(p) {
    if (p == null) return '·';
    if (p < 0.001) return '< 0,001';
    return p.toFixed(4).replace('.', ',');
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Régression linéaire</h1>
          <p className="page-sub">Régression OLS sur le cours historique d'un ETF. Mesure la tendance de long terme, ses limites, et confirme pourquoi le DCA est plus rationnel que le market timing.</p>
        </div>
        <div className="page-meta">
          {result && (
            <>
              <span>modèle <b>Y = β₀ + β₁·X</b></span>
              <span><b>{(result.dates?.length || 0).toLocaleString('fr-FR')}</b> observations affichées</span>
              <span>fenêtre <b>{result.fenetre_annees} ans</b></span>
            </>
          )}
        </div>
      </div>

      <div className="reg-grid">
        {/* ====== LEFT: form ====== */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <div className="panel-head">
            <div className="panel-title">
              <span className="panel-eyebrow">Paramètres</span>Régression OLS
            </div>
            <span className="badge mono">OLS</span>
          </div>
          <div className="panel-body sim-form">
            <div className="field">
              <label className="label">ETF</label>
              <select className="input" value={ticker} onChange={e => setTicker(e.target.value)}>
                {etfs.map(e => <option key={e.id ?? e.ticker} value={e.ticker}>{e.ticker} · {e.nom}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="label">Fenêtre d'analyse</label>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="dim mono" style={{ fontSize: 11 }}>3 ans</span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-0)' }}>{fenetre}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> ans</span></span>
                <span className="dim mono" style={{ fontSize: 11 }}>15 ans</span>
              </div>
              <input className="range" type="range" min="3" max="15" step="1"
                value={fenetre} onChange={e => setFenetre(+e.target.value)} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                {[3, 5, 7, 10, 12, 15].map(y => (
                  <button key={y} className={'btn sm' + (fenetre === y ? ' primary' : '')} onClick={() => setFenetre(y)}>{y}</button>
                ))}
              </div>
            </div>

            <div className="divider" style={{ margin: '6px 0' }}></div>

            {/* Multi-ETF comparison */}
            <div className="field">
              <label className="label">Comparer avec (max 3 ETF)</label>
              {compareTickers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {compareTickers.map(t => (
                    <span key={t} className="badge accent" style={{ paddingRight: 4 }}>
                      {t}
                      <button
                        onClick={() => setCompareTickers(prev => prev.filter(x => x !== t))}
                        style={{ marginLeft: 4, color: 'var(--accent)', fontSize: 11, opacity: 0.7 }}
                        title="Retirer"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              {compareTickers.length < 3 && (
                <select
                  className="input"
                  value=""
                  onChange={e => {
                    const v = e.target.value;
                    if (v && !compareTickers.includes(v) && v !== ticker) {
                      setCompareTickers(prev => [...prev, v]);
                    }
                  }}
                >
                  <option value="">· Ajouter un ETF ·</option>
                  {etfs.filter(e => e.ticker !== ticker && !compareTickers.includes(e.ticker)).map(e => (
                    <option key={e.id ?? e.ticker} value={e.ticker}>{e.ticker} · {e.nom}</option>
                  ))}
                </select>
              )}
              <div className="dim mono" style={{ fontSize: 10.5, marginTop: 4 }}>
                appel <code>/regression/comparaison/</code> en plus du calcul principal
              </div>
            </div>

            <div className="col" style={{ gap: 10 }}>
              <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={showCI} onChange={e => setShowCI(e.target.checked)} />
                <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>Bande de confiance 95 %</span>
              </label>
              <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={showProjection} onChange={e => setShowProjection(e.target.checked)} />
                <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>Projection +12 mois (illustrative)</span>
              </label>
            </div>

            <button className="btn primary" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }} onClick={run} disabled={running}>
              {running ? <><span className="spinner"></span> Calcul…</> : <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18"/><path d="m6 16 4-4 4 3 6-8"/></svg>
                Lancer la régression
              </>}
            </button>

            <div className="dim mono" style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.55 }}>
              X = jour de trading (0…N)<br/>
              Y = prix de clôture ajusté
            </div>

            {error && (
              <div style={{ marginTop: 10, padding: 10, border: '1px solid oklch(0.72 0.16 28 / 0.4)', borderRadius: 4, color: 'var(--neg)', fontSize: 12 }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* ====== RIGHT: results ====== */}
        <div className="col" style={{ gap: 18 }}>
          {/* Metrics strip */}
          {running ? <KpiSkeleton /> : result && (
            <div className="kpi-row fade-in">
              <div className="kpi">
                <div className="kpi-label">R² · coefficient de détermination</div>
                <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                  {result.r2 != null ? result.r2.toFixed(4).replace('.', ',') : '·'}
                </div>
                <div className="kpi-sub">{result.r2 != null ? (result.r2 * 100).toFixed(1) : '·'} % de variance expliquée</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Pente β₁ · €/jour</div>
                <div className="kpi-value">
                  {result.beta1 != null && result.beta1 >= 0 ? '+' : ''}{result.beta1?.toFixed(4).replace('.', ',') ?? '·'}
                  <span className="unit">€/j</span>
                </div>
                <div className="kpi-sub">≈ {result.pente_annualisee_pct?.toFixed(2) ?? '·'} %/an</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">p-value · test de pente</div>
                <div className="kpi-value" style={{ color: result.p_value < 0.001 ? 'var(--pos)' : 'var(--fg-0)' }}>
                  {fmtPVal(result.p_value)}
                </div>
                <div className="kpi-sub">{result.p_value < 0.001 ? 'tendance hautement significative' : 'à interpréter'}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Durbin-Watson</div>
                <div className="kpi-value">
                  {result.durbin_watson != null ? result.durbin_watson.toFixed(3).replace('.', ',') : '·'}
                </div>
                <div className="kpi-sub">{interpretDW(result.durbin_watson)}</div>
              </div>
            </div>
          )}

          {/* Main chart */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="panel-eyebrow">Tendance</span>
                Cours · droite de régression · IC 95 %
              </div>
              <div className="legend">
                <span className="lg-item">
                  <span className="lg-swatch" style={{ background: 'var(--fg-0)' }}></span>
                  prix observé
                </span>
                <span className="lg-item">
                  <span className="lg-swatch" style={{ background: 'var(--accent)' }}></span>
                  droite OLS
                </span>
                {showCI && <span className="lg-item">
                  <span className="lg-swatch" style={{ background: 'oklch(0.82 0.11 78 / 0.22)', height: 8 }}></span>
                  IC 95 %
                </span>}
                {showProjection && <span className="lg-item">
                <span className="lg-item">
                <span className="lg-swatch" style={{ background: 'oklch(0.82 0.11 78 / 0.14)', height: 8 }}></span>
                ±1σ / ±2σ / ±3σ
                </span>
                  <span className="lg-swatch dashed" style={{ color: 'var(--accent-dim)' }}></span>
                  projection 12 mois
                </span>}
              </div>
            </div>
            <div style={{ padding: '8px 16px' }}>
              {running ? <div className="skeleton" style={{ height: 360 }}></div> : result && (
                <RegressionChart
                  result={result}
                  showCI={showCI}
                  showProjection={showProjection}
                  height={360}
                />
              )}
            </div>
            {result && (
              <div className="fiche-grid" style={{ borderTop: '1px solid var(--line-1)' }}>
                <div className="fiche-cell">
                  <div className="label">β₀ · ordonnée</div>
                  <div className="val">{fmtNum(result.beta0, 2)}</div>
                </div>
                <div className="fiche-cell">
                  <div className="label">β₁ · pente jour</div>
                  <div className="val">{result.beta1?.toFixed(4).replace('.', ',') ?? '·'}</div>
                </div>
                <div className="fiche-cell">
                  <div className="label">Pente annualisée</div>
                  <div className="val">{result.pente_annualisee_pct?.toFixed(2) ?? '·'} %/an</div>
                </div>
                <div className="fiche-cell">
                  <div className="label">N observations</div>
                  <div className="val">{result.dates?.length?.toLocaleString('fr-FR') ?? '·'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Residuals */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="panel-eyebrow">Résidus</span>
                e_i = Y_i − (β₀ + β₁·X_i)
              </div>
              <div className="dim mono" style={{ fontSize: 11 }}>
                Devraient osciller autour de 0 si le modèle est bien spécifié
              </div>
            </div>
            <div style={{ padding: '8px 16px' }}>
              {running ? <div className="skeleton" style={{ height: 180 }}></div> : result?.residus && (
                <ResidualChart residuals={result.residus} dates={result.dates} height={200} />
              )}
            </div>
          </div>

          {/* Multi-ETF comparison table */}
          {comparison && comparison.length > 1 && (
            <div className="panel fade-in">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="panel-eyebrow">Comparaison</span>
                  Régression sur {comparison.length} ETF · fenêtre {fenetre} ans
                </div>
                <span className="dim mono" style={{ fontSize: 11 }}>même méthodologie OLS</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ETF</th>
                    <th className="num">R²</th>
                    <th className="num">Pente annualisée</th>
                    <th className="num">p-value</th>
                    <th className="num">Durbin-Watson</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const bestR2 = Math.max(...comparison.map(c => c.r2 || 0));
                    return comparison.map(r => (
                      <tr key={r.ticker}>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="ticker mono" style={{ color: r.ticker === ticker ? 'var(--accent)' : 'var(--fg-0)' }}>
                              {r.ticker}{r.ticker === ticker ? ' ●' : ''}
                            </span>
                            <span className="muted">{r.nom}</span>
                          </div>
                        </td>
                        <td className="num" style={{ color: r.r2 === bestR2 ? 'var(--pos)' : 'var(--fg-0)' }}>
                          {r.r2?.toFixed(4).replace('.', ',') ?? '·'}
                          {r.r2 === bestR2 && <span style={{ marginLeft: 6, color: 'var(--pos)' }}>▲</span>}
                        </td>
                        <td className="num" style={{ color: r.pente_annualisee_pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {r.pente_annualisee_pct >= 0 ? '+' : ''}{r.pente_annualisee_pct?.toFixed(2)} %/an
                        </td>
                        <td className="num" style={{ color: r.p_value < 0.001 ? 'var(--pos)' : 'var(--fg-0)' }}>
                          {fmtPVal(r.p_value)}
                        </td>
                        <td className="num">
                          {r.durbin_watson?.toFixed(3).replace('.', ',') ?? '·'}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Critical interpretation · visible, not hidden */}
          {result && (
            <div className="interp fade-in">
              <h4>
                Interprétation critique
                <span className="interp-tag">obligatoire · CDC §2.4</span>
              </h4>
              <p>
                Le R² de <b className="mono">{result.r2?.toFixed(3).replace('.', ',')}</b> sur {result.fenetre_annees} ans confirme une tendance haussière forte de l'indice répliqué par <b className="mono">{ticker}</b>. Cette tendance est <b>{result.p_value < 0.001 ? 'statistiquement très significative' : 'à interpréter avec précaution'}</b> (p {fmtPVal(result.p_value)}), avec une pente annualisée d'environ <b className="mono">{result.pente_annualisee_pct?.toFixed(2)} %/an</b>.
              </p>
              <ul>
                <li><strong>Régression fallacieuse · attention.</strong> Sur une série temporelle croissante, un R² élevé est <em>attendu</em> (Granger &amp; Newbold, 1974). Ce n'est pas la preuve d'un modèle prédictif : c'est l'indication d'une tendance.</li>
                <li><strong>Les résidus ne sont pas aléatoires.</strong> Ils présentent des cycles, des chocs (2020, 2022) et des phases d'autocorrélation. Durbin-Watson = <b className="mono">{result.durbin_watson?.toFixed(2)}</b> {interpretDWPhrase(result.durbin_watson)}.</li>
                <li><strong>La projection 12 mois est illustrative.</strong> L'intervalle de confiance s'élargit dans le futur ; tout point au-delà de la fenêtre observée doit être lu comme un ordre de grandeur, jamais comme une prévision.</li>
                <li><strong>Implication stratégique.</strong> Puisque la tendance est claire mais le timing imprévisible, lisser l'entrée en marché par un DCA mensuel est statistiquement plus rationnel que d'attendre « le bon moment ».</li>
              </ul>
              <div className="quote">
                « La régression confirme une tendance, pas un timing. C'est pourquoi le DCA est plus rationnel que d'essayer de trouver le bon moment pour investir. »
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function interpretDW(dw) {
  if (dw == null) return '·';
  if (dw < 1.5) return 'autocorrélation positive';
  if (dw > 2.5) return 'autocorrélation négative';
  return 'résidus quasi-indépendants';
}
function interpretDWPhrase(dw) {
  if (dw == null) return '';
  if (dw < 1.5) return '→ autocorrélation positive (cycles, momentum)';
  if (dw > 2.5) return '→ autocorrélation négative';
  return '→ résidus quasi-indépendants';
}

function KpiSkeleton() {
  return (
    <div className="kpi-row">
      {[0,1,2,3].map(i => (
        <div className="kpi" key={i}>
          <div className="skeleton" style={{ height: 10, width: 80, marginBottom: 8 }}></div>
          <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 6 }}></div>
          <div className="skeleton" style={{ height: 10, width: 100 }}></div>
        </div>
      ))}
    </div>
  );
}

// =============================================================
// RegressionChart · uses backend response shape directly
// =============================================================
function RegressionChart({ result, showCI, showProjection, height = 360 }) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState(null);

  // Combine historic + projection
  const histDates = result.dates || [];
  const histPrix  = result.prix || [];
  const histFit   = result.regression_line || [];
  const histUp    = result.ic_upper || [];
  const histLo    = result.ic_lower || [];

  // Bandes sigma : écart-type des résidus autour de la droite OLS
  // ±1σ : 68 % des prix, ±2σ : 95 %, ±3σ : 99,7 % (sous hypothèse normale)
  const sig3Up = result.sigma3_upper || [];
  const sig3Lo = result.sigma3_lower || [];
  const sig2Up = result.sigma2_upper || [];
  const sig2Lo = result.sigma2_lower || [];
  const sig1Up = result.sigma1_upper || [];
  const sig1Lo = result.sigma1_lower || [];



  const projDates = showProjection ? (result.projection_dates || []) : [];
  const projFit   = showProjection ? (result.projection_line || []) : [];
  const projUp    = showProjection ? (result.projection_ic_upper || []) : [];
  const projLo    = showProjection ? (result.projection_ic_lower || []) : [];

  const dates  = [...histDates, ...projDates];
  const prices = [...histPrix, ...projDates.map(() => null)];
  const fit    = [...histFit, ...projFit];
  const upper  = [...histUp, ...projUp];
  const lower  = [...histLo, ...projLo];
  const cutoff = histDates.length - 1;

  const W = Math.max(width, 200);
  const H = height;
  const padding = { top: 14, right: 14, bottom: 26, left: 60 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;

  if (dates.length < 2) return <div style={{ height: H, color: 'var(--fg-3)', display: 'grid', placeItems: 'center' }}>Données insuffisantes</div>;

  const allVals = [...fit, ...upper, ...lower, ...prices.filter(v => v != null && !isNaN(v))];
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  const pad = (yMax - yMin) * 0.05;
  const scale = niceScale(yMin - pad, yMax + pad, 5);

  const xAt = i => padding.left + (i / (dates.length - 1)) * innerW;
  const yAt = v => padding.top + (1 - (v - scale.min) / (scale.max - scale.min)) * innerH;

  function path(arr, from, to) {
    let p = '';
    for (let i = from; i <= to; i++) {
      const v = arr[i];
      if (v == null || isNaN(v)) continue;
      p += (p ? ' L ' : 'M ') + xAt(i).toFixed(2) + ' ' + yAt(v).toFixed(2);
    }
    return p;
  }

  function bandPath(low, up, from, to) {
    let p = '';
    for (let i = from; i <= to; i++) {
      p += (p ? ' L ' : 'M ') + xAt(i).toFixed(2) + ' ' + yAt(up[i]).toFixed(2);
    }
    for (let i = to; i >= from; i--) {
      p += ' L ' + xAt(i).toFixed(2) + ' ' + yAt(low[i]).toFixed(2);
    }
    p += ' Z';
    return p;
  }

  const xTicks = pickDateTicks(dates, 7);
  const yTicks = scale.ticks;

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < padding.left || x > padding.left + innerW) { setHover(null); return; }
    const ratio = (x - padding.left) / innerW;
    const i = Math.round(ratio * (dates.length - 1));
    setHover({ i, x: xAt(i) });
  }

  return (
    <div className="chart-wrap" ref={ref} style={{ height: H }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t, i) => (
          <line key={i} x1={padding.left} x2={padding.left + innerW} y1={yAt(t)} y2={yAt(t)} stroke="var(--line-1)" shapeRendering="crispEdges" />
        ))}
        {showProjection && cutoff < dates.length - 1 && (
          <rect
            x={xAt(cutoff)} y={padding.top}
            width={innerW - (xAt(cutoff) - padding.left)} height={innerH}
            fill="oklch(0.165 0.005 240 / 0.7)"
          />
        )}
        {showProjection && cutoff < dates.length - 1 && (
          <line x1={xAt(cutoff)} x2={xAt(cutoff)} y1={padding.top} y2={padding.top + innerH} stroke="var(--line-3)" strokeDasharray="2 4" />
        )}

        {/* Bandes sigma, de l'extérieur vers l'intérieur pour superposition correcte */}
          {sig3Up.length > 0 && (
            <path d={bandPath(sig3Lo, sig3Up, 0, cutoff)}
              fill="oklch(0.82 0.11 78 / 0.04)" stroke="none" />
          )}
          {sig2Up.length > 0 && (
            <path d={bandPath(sig2Lo, sig2Up, 0, cutoff)}
              fill="oklch(0.82 0.11 78 / 0.08)" stroke="none" />
          )}
          {sig1Up.length > 0 && (
            <path d={bandPath(sig1Lo, sig1Up, 0, cutoff)}
              fill="oklch(0.82 0.11 78 / 0.14)" stroke="none" />
          )}

        {showCI && histUp.length > 0 && (
          <path d={bandPath(lower, upper, 0, cutoff)}
            fill="oklch(0.82 0.11 78 / 0.22)"
            stroke="oklch(0.82 0.11 78 / 0.18)"
            strokeWidth="0.5" />
        )}
        {showCI && showProjection && cutoff < dates.length - 1 && (
          <path d={bandPath(lower, upper, cutoff, dates.length - 1)}
            fill="oklch(0.82 0.11 78 / 0.10)"
            stroke="oklch(0.82 0.11 78 / 0.12)"
            strokeWidth="0.5"
            strokeDasharray="3 3" />
        )}
        <path d={path(prices, 0, cutoff)} fill="none" stroke="var(--fg-0)" strokeWidth="1.4" strokeLinejoin="round" />
        <path d={path(fit, 0, cutoff)} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
        {showProjection && cutoff < dates.length - 1 && (
          <path d={path(fit, cutoff, dates.length - 1)} fill="none" stroke="var(--accent-dim)" strokeWidth="1.6" strokeDasharray="4 4" />
        )}
        {showProjection && cutoff < dates.length - 1 && (
          <g>
            <rect x={xAt(cutoff) + 4} y={padding.top + 4} width={92} height={18} rx={3} fill="oklch(0.135 0.005 240 / 0.85)" stroke="var(--line-2)" />
            <text x={xAt(cutoff) + 12} y={padding.top + 16} fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)" letterSpacing="0.06em">PROJECTION 12M</text>
          </g>
        )}
        {xTicks.map((idx, i) => (
          <text key={'xt' + i} x={xAt(idx)} y={padding.top + innerH + 16} textAnchor="middle" fill="var(--fg-3)" fontSize="10" fontFamily="var(--font-mono)">
            {fmtDate(dates[idx], 'ym')}
          </text>
        ))}
        {yTicks.map((t, i) => (
          <text key={'yt' + i} x={padding.left - 8} y={yAt(t) + 3} textAnchor="end" fill="var(--fg-3)" fontSize="10" fontFamily="var(--font-mono)">
            {fmtNum(t, 0)} €
          </text>
        ))}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padding.top} y2={padding.top + innerH} stroke="var(--line-3)" strokeDasharray="2 3" />
            {prices[hover.i] != null && !isNaN(prices[hover.i]) && (
              <circle cx={hover.x} cy={yAt(prices[hover.i])} r="3" fill="var(--bg-0)" stroke="var(--fg-0)" strokeWidth="1.5" />
            )}
            <circle cx={hover.x} cy={yAt(fit[hover.i])} r="3" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: padding.top - 8 }}>
          <div className="tt-date">{fmtDate(dates[hover.i], 'long')}{hover.i > cutoff ? ' · projeté' : ''}</div>
          {prices[hover.i] != null && !isNaN(prices[hover.i]) && (
            <div className="tt-row">
              <span className="tt-label"><span className="swatch" style={{ background: 'var(--fg-0)' }}></span>Cours</span>
              <span className="tt-val">{fmtNum(prices[hover.i], 2)} €</span>
            </div>
          )}
          <div className="tt-row">
            <span className="tt-label"><span className="swatch" style={{ background: 'var(--accent)' }}></span>Droite OLS</span>
            <span className="tt-val">{fmtNum(fit[hover.i], 2)} €</span>
          </div>
          {showCI && (
            <div className="tt-row">
              <span className="tt-label dim">IC 95 %</span>
              <span className="tt-val dim">±{fmtNum((upper[hover.i] - lower[hover.i]) / 2, 2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
