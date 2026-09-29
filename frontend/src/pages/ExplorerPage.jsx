/* ============================================================
   TELOS · ExplorerPage
   Remplace : Accueil.jsx + FicheETF.jsx + Compare.jsx
   Routes : /, /etf/:ticker, /compare
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LineChart, Sparkline, fmtEUR, fmtPct, fmtNum, fmtDate } from '../components/Charts.jsx';
import * as api from '../api/index.js';

const RANGE_LABEL = { '6M': '6 mois', '1A': '1 an', '3A': '3 ans', '5A': '5 ans', '10A': '10 ans', 'MAX': 'Max' };

function computeStartDate(range) {
  const d = new Date();
  if (range === '6M')  { d.setMonth(d.getMonth() - 6);       return d.toISOString().slice(0, 10); }
  if (range === '1A')  { d.setFullYear(d.getFullYear() - 1);  return d.toISOString().slice(0, 10); }
  if (range === '3A')  { d.setFullYear(d.getFullYear() - 3);  return d.toISOString().slice(0, 10); }
  if (range === '5A')  { d.setFullYear(d.getFullYear() - 5);  return d.toISOString().slice(0, 10); }
  if (range === '10A') { d.setFullYear(d.getFullYear() - 10); return d.toISOString().slice(0, 10); }
  if (range === 'MAX') return '2000-01-01';
  d.setFullYear(d.getFullYear() - 3);
  return d.toISOString().slice(0, 10);
}

export default function ExplorerPage({ compareMode: forcedCompareMode = false }) {
  const { ticker: urlTicker } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [etfs, setEtfs] = useState(null);
  const [etfsErr, setEtfsErr] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(urlTicker || null);
  const [compareTicker, setCompareTicker] = useState(null);
  const [compareMode, setCompareMode] = useState(forcedCompareMode || location.pathname === '/compare');
  const [searchQ, setSearchQ] = useState('');
  const [filter, setFilter] = useState(null);
  const [range, setRange] = useState('3A');

  useEffect(() => {
    let alive = true;
    api.listeETF()
      .then(r => {
        if (!alive) return;
        const list = Array.isArray(r) ? r : [];
        setEtfs(list);
        if (!selectedTicker && list.length) {
          setSelectedTicker(list[0].ticker);
          if (list.length >= 2) setCompareTicker(list[1].ticker);
        }
      })
      .catch(e => { if (alive) setEtfsErr(e.message || 'Erreur API'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (urlTicker && urlTicker !== selectedTicker) setSelectedTicker(urlTicker);
  }, [urlTicker]);

  const [hist, setHist] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  useEffect(() => {
    if (!selectedTicker) return;
    setHistLoading(true);
    const dateDebut = computeStartDate(range);
    api.historiqueETF(selectedTicker, dateDebut)
      .then(r => {
        const data = Array.isArray(r) ? r : [];
        setHist(data);
      })
      .catch(() => setHist([]))
      .finally(() => setHistLoading(false));
  }, [selectedTicker, range]);

  // Sparkline data per ETF
  const [sparks, setSparks] = useState({});
  useEffect(() => {
    if (!etfs || !etfs.length) return;
    const dateDebut = computeStartDate('3A');
    Promise.allSettled(
      // Le cache backend (TTL 1h) absorbe les appels suivants.
      etfs.slice(0, 15).map(e =>
        api.historiqueETF(e.ticker, dateDebut).then(r => {
          const arr = Array.isArray(r) ? r : [];
          const step = Math.max(1, Math.floor(arr.length / 40));
          return [e.ticker, arr.filter((_, i) => i % step === 0).map(d => d.prix_cloture_ajuste)];
        })
      )
    ).then(results => {
      const next = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const [t, data] = r.value;
          next[t] = data;
        }
      }
      setSparks(next);
    });
  }, [etfs?.length]); // eslint-disable-line

  const [histCompare, setHistCompare] = useState(null);
  useEffect(() => {
    if (!compareMode || !compareTicker) { setHistCompare(null); return; }
    const dateDebut = computeStartDate(range);
    api.historiqueETF(compareTicker, dateDebut)
      .then(r => setHistCompare(Array.isArray(r) ? r : []))
      .catch(() => setHistCompare([]));
  }, [compareTicker, range, compareMode]);

  const compareAligned = useMemo(() => {
    if (!compareMode || !hist || !histCompare || hist.length === 0 || histCompare.length === 0) return null;
    const len = Math.min(hist.length, histCompare.length);
    const a = hist.slice(-len);
    const b = histCompare.slice(-len);
    const base1 = a[0].prix_cloture_ajuste;
    const base2 = b[0].prix_cloture_ajuste;
    return {
      dates: a.map(d => d.date),
      a: a.map(d => 100 * d.prix_cloture_ajuste / base1),
      b: b.map(d => 100 * d.prix_cloture_ajuste / base2),
    };
  }, [hist, histCompare, compareMode]);

  if (etfsErr) return <ErrorBlock message={etfsErr} />;
  if (etfs === null) return <ListSkeleton />;
  if (etfs.length === 0) return <EmptyState />;

  const selected = etfs.find(e => e.ticker === selectedTicker) || etfs[0];
  const compare  = etfs.find(e => e.ticker === compareTicker);

  const filtered = etfs.filter(e => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!(e.ticker?.toLowerCase().includes(q) ||
            e.nom?.toLowerCase().includes(q) ||
            e.nom_long_yf?.toLowerCase().includes(q) ||
            e.indice_replique?.toLowerCase().includes(q))) return false;
    }
    if (filter === 'PEA' && !e.eligible_pea) return false;
    if (filter === 'Halal' && !e.is_halal) return false;
    if (filter && filter !== 'PEA' && filter !== 'Halal') {
      const cat = categorieETF(e);
      if (filter === 'World'  && cat !== 0) return false;
      if (filter === 'US'     && cat !== 1 && cat !== 2) return false;
      if (filter === 'Europe' && cat !== 3) return false;
      if (filter === 'EM'     && cat !== 4) return false;
      if (filter === 'Bonds'  && cat !== 6) return false;
    }
    return true;
  });

  const prices = (hist || []).map(d => d.prix_cloture_ajuste);
  const dates  = (hist || []).map(d => d.date);
  const last   = prices.length ? prices[prices.length - 1] : null;
  const first  = prices.length ? prices[0] : null;
  const perfTotal = last && first ? last / first - 1 : null;
  const perf1y = prices.length >= 252
    ? prices[prices.length - 1] / prices[prices.length - 252] - 1
    : null;
  const high = prices.length ? Math.max(...prices) : null;
  const low  = prices.length ? Math.min(...prices) : null;

  function onPickEtf(ticker) {
    setSelectedTicker(ticker);
    navigate('/etf/' + ticker);
  }

  function toggleCompare() {
    if (!compareMode) {
      setCompareMode(true);
      if (!compareTicker || compareTicker === selectedTicker) {
        const other = etfs.find(e => e.ticker !== selectedTicker);
        if (other) setCompareTicker(other.ticker);
      }
      navigate('/compare');
    } else {
      setCompareMode(false);
      navigate('/etf/' + selectedTicker);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Explorateur ETF</h1>
          <p className="page-sub">Recherchez un ETF, consultez ses caractéristiques et son historique de cours. Comparez deux fonds sur la même fenêtre temporelle.</p>
        </div>
        <div className="page-meta">
          <span><b>{etfs.length}</b> ETF disponibles</span>
          {hist && <span><b>{hist.length.toLocaleString('fr-FR')}</b> jours de trading</span>}
        </div>
      </div>

      <div className="explorer">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 220px)' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line-1)' }}>
            <div className="search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                className="search-input"
                placeholder="Rechercher ticker, indice…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>
          </div>
          <div className="etf-list" style={{ overflowY: 'auto' }}>
            {filtered.map(e => (
              <div
                key={e.id ?? e.ticker}
                className={'etf-row' + (e.ticker === selectedTicker ? ' selected' : '')}
                onClick={() => onPickEtf(e.ticker)}
              >
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="etf-ticker">{e.ticker}</span>
                    {e.eligible_pea && <span className="badge pea">PEA</span>}
                    {e.is_halal && <span className="badge accent">HALAL</span>}
                  </div>
                  {sparks[e.ticker] && sparks[e.ticker].length > 1 && (
                    <Sparkline data={sparks[e.ticker]} width={70} height={22}
                      positiveColor="var(--pos)" negativeColor="var(--neg)" />
                  )}
                </div>
                <div className="etf-name">{e.nom_long_yf || e.nom}</div>
                <div className="etf-ter" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="dim mono">{e.indice_replique || e.gestionnaire || ''}</span>
                  <span>{e.ter != null ? `TER ${(e.ter * 100).toFixed(2)} %` : 'TER N/A'}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 18, color: 'var(--fg-3)', fontSize: 12 }}>Aucun ETF.</div>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 18 }}>
          <div className="panel">
            <div className="panel-head" style={{ padding: '14px 18px' }}>
              <div className="row" style={{ gap: 14 }}>
                <div>
                  <div className="row" style={{ gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '0.01em' }}>{selected.ticker}</div>
                    <div style={{ fontSize: 14, color: 'var(--fg-1)' }}>{selected.nom_long_yf || selected.nom}</div>
                  </div>
                  <div className="badge-row" style={{ marginTop: 6 }}>
                    {selected.eligible_pea && <span className="badge pea">Éligible PEA</span>}
                    {selected.is_halal && <span className="badge accent">Halal</span>}
                    {selected.indice_replique && <span className="badge">{selected.indice_replique}</span>}
                    {selected.gestionnaire && <span className="badge">{selected.gestionnaire}</span>}
                    {selected.ticker_yf && <span className="badge mono">{selected.ticker_yf}</span>}
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div className="seg">
                  {['6M', '1A', '3A', '5A', '10A', 'MAX'].map(r => (
                    <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
                  ))}
                </div>
                <button
                  className={'btn' + (compareMode ? ' primary' : '')}
                  onClick={toggleCompare}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v18M16 3v18M3 8h5M3 16h5M16 8h5M16 16h5"/></svg>
                  Comparer
                </button>
              </div>
            </div>

            <div className="fiche-grid">
              <div className="fiche-cell">
                <div className="label">Cours dernier</div>
                <div className="val">{last != null ? fmtEUR(last, { decimals: 2 }) : '·'}</div>
                <div className={'delta ' + (perf1y == null ? '' : perf1y > 0 ? 'pos' : 'neg')}>
                  {perf1y == null ? '·' : (perf1y >= 0 ? '▲ ' : '▼ ') + fmtPct(perf1y, 2)} <span className="dim">/ 1A</span>
                </div>
              </div>
              <div className="fiche-cell">
                <div className="label">Indice répliqué</div>
                <div className="val" style={{ fontSize: 13, lineHeight: 1.3 }}>{selected.indice_replique || '·'}</div>
                <div className="dim mono" style={{ fontSize: 11 }}>{selected.gestionnaire || '·'}</div>
              </div>
              <div className="fiche-cell">
                <div className="label">TER annuel</div>
                <div className="val">{selected.ter != null ? fmtPct(selected.ter, 2) : '·'}</div>
                <div className="dim mono" style={{ fontSize: 11 }}>frais courants</div>
              </div>
              <div className="fiche-cell">
                <div className="label">PEA / Halal</div>
                <div className="val">
                  {selected.eligible_pea ? 'PEA ✓' : 'Hors PEA'}
                  <span className="dim" style={{ marginLeft: 8, fontSize: 12 }}>
                    {selected.is_halal ? '· Halal' : ''}
                  </span>
                </div>
                <div className="dim mono" style={{ fontSize: 11 }}>{selected.ticker_yf}</div>
              </div>
            </div>
          </div>

          {!compareMode && (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="panel-eyebrow">Cours</span>
                  {selected.ticker} · {RANGE_LABEL[range]}
                </div>
                <div className="legend">
                  <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--fg-0)' }}></span>Prix de clôture ajusté</span>
                </div>
              </div>
              <div style={{ padding: '8px 16px 8px' }}>
                {histLoading ? (
                  <div className="skeleton" style={{ height: 360 }}></div>
                ) : hist && hist.length > 0 ? (
                  <LineChart
                    dates={dates}
                    series={[
                      { name: selected.ticker, data: prices, color: 'var(--fg-0)', width: 1.6, format: v => fmtEUR(v, { decimals: 2 }) },
                    ]}
                    height={360}
                    fillFirst
                    yFormat={v => fmtNum(v, 0) + ' €'}
                  />
                ) : (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>Aucune donnée historique disponible.</div>
                )}
              </div>
              {hist && hist.length > 0 && (
                <div className="fiche-grid" style={{ borderTop: '1px solid var(--line-1)' }}>
                  <div className="fiche-cell">
                    <div className="label">Perf cumulée</div>
                    <div className="val" style={{ color: perfTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {perfTotal >= 0 ? '+' : ''}{fmtPct(perfTotal, 2)}
                    </div>
                  </div>
                  <div className="fiche-cell">
                    <div className="label">Plus haut</div>
                    <div className="val">{fmtEUR(high, { decimals: 2 })}</div>
                  </div>
                  <div className="fiche-cell">
                    <div className="label">Plus bas</div>
                    <div className="val">{fmtEUR(low, { decimals: 2 })}</div>
                  </div>
                  <div className="fiche-cell">
                    <div className="label">Volatilité (est.)</div>
                    <div className="val">{(estVolatility(prices) * 100).toFixed(1)} %</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {compareMode && (
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="panel-eyebrow">Comparaison</span>
                  {selected.ticker} <span className="dim">vs</span> {compare?.ticker || '·'} · base 100 · {RANGE_LABEL[range]}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <select
                    className="input"
                    style={{ height: 26, fontSize: 12 }}
                    value={compareTicker || ''}
                    onChange={e => setCompareTicker(e.target.value)}
                  >
                    {etfs.filter(e => e.ticker !== selectedTicker).map(e => (
                      <option key={e.id ?? e.ticker} value={e.ticker}>{e.ticker} · {e.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ padding: '8px 16px' }}>
                {!compareAligned ? (
                  <div className="skeleton" style={{ height: 340 }}></div>
                ) : (
                  <LineChart
                    dates={compareAligned.dates}
                    series={[
                      { name: selected.ticker, data: compareAligned.a, color: 'var(--fg-0)', width: 1.6, format: v => v.toFixed(2) },
                      { name: compare.ticker, data: compareAligned.b, color: 'var(--accent)', width: 1.6, format: v => v.toFixed(2) },
                    ]}
                    height={340}
                    yFormat={v => v.toFixed(0)}
                  />
                )}
              </div>
              {hist && histCompare && (
                <div className="compare-grid" style={{ padding: 16, borderTop: '1px solid var(--line-1)' }}>
                  <CompareCard etf={selected}  serie={hist}        accent="var(--fg-0)" />
                  <CompareCard etf={compare}   serie={histCompare} accent="var(--accent)" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareCard({ etf, serie, accent }) {
  if (!etf || !serie || !serie.length) return null;
  const prices = serie.map(d => d.prix_cloture_ajuste);
  const perf = prices[prices.length - 1] / prices[0] - 1;
  const vol = estVolatility(prices);
  return (
    <div className="minicard">
      <div className="minicard-head">
        <div>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="lg-swatch" style={{ width: 12, height: 2, background: accent, borderRadius: 1 }}></span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{etf.ticker}</span>
            <span className="muted" style={{ fontSize: 12 }}>{etf.nom}</span>
          </div>
          <div className="minicard-sub mono">{etf.indice_replique} · {etf.gestionnaire}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {etf.eligible_pea && <span className="badge pea">PEA</span>}
        </div>
      </div>
      <table className="tbl" style={{ marginLeft: -16, marginRight: -16, width: 'calc(100% + 32px)' }}>
        <tbody>
          <tr>
            <td className="dim">Performance fenêtre</td>
            <td className="num" style={{ color: perf >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {perf >= 0 ? '+' : ''}{fmtPct(perf, 2)}
            </td>
          </tr>
          <tr>
            <td className="dim">TER</td>
            <td className="num">{etf.ter != null ? fmtPct(etf.ter, 2) : '·'}</td>
          </tr>
          <tr>
            <td className="dim">Volatilité ann.</td>
            <td className="num">{(vol * 100).toFixed(1)} %</td>
          </tr>
          <tr>
            <td className="dim">PEA éligible</td>
            <td className="num">{etf.eligible_pea ? 'oui' : 'non'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div className="skeleton" style={{ height: 28, width: 240, marginBottom: 20 }}></div>
      <div className="skeleton" style={{ height: 400 }}></div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>
      Aucun ETF dans la base. Vérifiez le seed du backend.
    </div>
  );
}

function ErrorBlock({ message }) {
  return (
    <div style={{ padding: 24, color: 'var(--neg)', fontSize: 14 }}>
      <strong>Erreur API :</strong> {message}<br/>
      <span className="dim" style={{ fontSize: 12 }}>Vérifie que le backend FastAPI tourne sur <code>http://localhost:8000</code>.</span>
    </div>
  );
}

function estVolatility(prices) {
  if (!prices || prices.length < 2) return 0;
  const rets = [];
  for (let i = 1; i < prices.length; i++) rets.push(Math.log(prices[i] / prices[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v * 252);
}

function categorieETF(etf) {
  const txt = [etf.nom, etf.indice_replique, etf.nom_long_yf].filter(Boolean).join(' ').toLowerCase();
  if (/world|global|acwi|all.country|msci world/.test(txt)) return 0;
  if (/s&p.?500|sp.?500/.test(txt))                          return 1;
  if (/nasdaq|us.tech|technology/.test(txt))                 return 2;
  if (/europe|euro.?stoxx|stoxx|cac/.test(txt))              return 3;
  if (/emerging|émergent|em\b/.test(txt))                    return 4;
  if (/japan|nikkei|topix/.test(txt))                        return 5;
  if (/bond|obligat|government|trésor|gilt|treasury/.test(txt)) return 6;
  if (/gold|or\b|silver|commodity|matière/.test(txt))        return 7;
  if (/real.estate|reit|immob/.test(txt))                    return 8;
  return 9;
}