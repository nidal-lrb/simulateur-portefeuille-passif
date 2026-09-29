/* ============================================================
   TELOS · SimulatorPage
   Remplace : Simulation.jsx
   Route : /simulation
   Modes : Backtesting historique + Projection future
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, fmtEUR, fmtPct, fmtNum, fmtDate } from '../components/Charts.jsx';
import * as api from '../api/index.js';

function today()     { return new Date().toISOString().slice(0, 10); }
function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

export default function SimulatorPage() {
  const [mode, setMode] = useState('backtest');   // 'backtest' | 'projection'
  const [etfs, setEtfs] = useState([]);

  // Common
  const [capitalInitial, setCapitalInitial] = useState(1000);
  const [versementMensuel, setVersementMensuel] = useState(200);

  // Backtest · etfSelected is full ETF object (DB or Yahoo result)
  const [etfSelected, setEtfSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const ddRef = React.useRef(null);

  const [dateDebut, setDateDebut] = useState(yearsAgo(10));
  const [dateFin, setDateFin] = useState(today());
  const [ter, setTer] = useState(0);

  // Projection
  const [tauxAnnuel, setTauxAnnuel] = useState(0.07);
  const [terProj, setTerProj] = useState(0.0020);
  const [nbAnnees, setNbAnnees] = useState(20);

  const [showLivretA, setShowLivretA] = useState(true);
  const [showNoFees, setShowNoFees] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [resultB, setResultB] = useState(null);
  const [resultP, setResultP] = useState(null);

  // Charger la liste ETF sans sélection par défaut
  useEffect(() => {
    api.listeETF()
      .then(r => {
        const list = Array.isArray(r) ? r : [];
        setEtfs(list);
      })
      .catch(e => setError(e.message));
  }, []);

  // Debounced search across DB + Yahoo Finance
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.rechercherETF(query);
        const list = Array.isArray(r) ? r : [r];
        setSuggestions(list.slice(0, 8));
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // close dropdown on click outside
  useEffect(() => {
    function h(e) { if (ddRef.current && !ddRef.current.contains(e.target)) setSuggestions([]); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function pickEtf(e) {
    setEtfSelected(e);
    setTer(e.id != null && e.ter != null ? e.ter : 0);
    setQuery('');
    setSuggestions([]);
    setResultB(null);
  }

  function clearEtf() {
    setEtfSelected(null);
    setResultB(null);
  }

  const ticker = etfSelected?.ticker || '';
  const estReferentiel = etfSelected?.id != null;

  async function runBacktest() {
    if (!etfSelected) return;
    setRunning(true); setError(null);
    try {
      const r = await api.simulerDCA({
        ticker: etfSelected.ticker,
        capitalInitial,
        versementMensuel,
        dateDebut,
        dateFin,
        terOverride: ter,
      });
      setResultB(r);
    } catch (e) {
      setError(e.message || 'Erreur API'); setResultB(null);
    } finally { setRunning(false); }
  }

  async function runProjection() {
    setRunning(true); setError(null);
    try {
      const r = await api.projetterDCA({
        capitalInitial,
        versementMensuel,
        tauxAnnuel,
        ter: terProj,
        nbAnnees,
      });
      setResultP(r);
    } catch (e) {
      setError(e.message || 'Erreur API'); setResultP(null);
    } finally { setRunning(false); }
  }

  // Lancer la projection au chargement en mode projection
  useEffect(() => {
    if (mode === 'projection' && !resultP) runProjection();
    // eslint-disable-next-line
  }, [mode]);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Simulateur DCA</h1>
          <p className="page-sub">
            {mode === 'backtest'
              ? "Backtesting d'une stratégie d'investissement programmé sur données historiques réelles. Le passé n'est jamais une garantie."
              : "Projection future d'un DCA · calcul théorique. Hypothèse de rendement constant, à interpréter comme un ordre de grandeur, pas comme une prévision."
            }
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={mode === 'backtest' ? 'on' : ''} onClick={() => setMode('backtest')}>
          BACKTESTING HISTORIQUE
        </button>
        <button className={mode === 'projection' ? 'on' : ''} onClick={() => setMode('projection')}>
          PROJECTION FUTURE
        </button>
      </div>

      <div className="sim-grid">
        {/* ====== LEFT: form ====== */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <div className="panel-head">
            <div className="panel-title">
              <span className="panel-eyebrow">Paramètres</span>
              {mode === 'backtest' ? 'Backtest DCA' : 'Projection future'}
            </div>
            <span className="badge mono">{mode}</span>
          </div>

          {/* Backtest form */}
          {mode === 'backtest' && (
            <div className="panel-body sim-form">
              <div className="field">
                <label className="label">
                  ETF · <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>référentiel ou Yahoo Finance</span>
                </label>
                {etfSelected ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', background: 'var(--bg-2)',
                    border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                        {etfSelected.ticker}
                      </div>
                      <div className="dim" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {etfSelected.nom_long_yf || etfSelected.nom}
                      </div>
                    </div>
                    <div className="badge-row" style={{ flexShrink: 0 }}>
                      {!estReferentiel       && <span className="badge">YF</span>}
                      {etfSelected.eligible_pea && <span className="badge pea">PEA</span>}
                      {etfSelected.is_halal     && <span className="badge accent">HALAL</span>}
                    </div>
                    <button onClick={clearEtf} title="Changer d'ETF"
                      style={{ color: 'var(--fg-3)', fontSize: 18, flexShrink: 0, padding: '0 4px' }}
                    >×</button>
                  </div>
                ) : (
                  <div ref={ddRef} style={{ position: 'relative' }}>
                    <div className="search-wrap">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                      <input
                        className="search-input"
                        placeholder="Ex : CW8, VWCE, S&P 500…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {(suggestions.length > 0 || searchLoading) && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: 'var(--bg-2)', border: '1px solid var(--line-2)',
                        borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-pop)',
                        zIndex: 50, maxHeight: 320, overflowY: 'auto',
                      }}>
                        {searchLoading && (
                          <div style={{ padding: '10px 12px', color: 'var(--fg-3)', fontSize: 13 }}>
                            Recherche…
                          </div>
                        )}
                        {!searchLoading && suggestions.map(s => (
                          <div
                            key={s.ticker}
                            onClick={() => pickEtf(s)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', cursor: 'pointer',
                              borderBottom: '1px solid var(--line-1)',
                            }}
                            onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-3)')}
                            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                          >
                            <span className="mono" style={{ fontWeight: 600, color: 'var(--fg-0)', minWidth: 60 }}>{s.ticker}</span>
                            <span className="dim" style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.nom_long_yf || s.nom}
                            </span>
                            <span className="badge-row" style={{ flexShrink: 0 }}>
                              {s.id == null       && <span className="badge">YF</span>}
                              {s.eligible_pea     && <span className="badge pea">PEA</span>}
                              {s.is_halal         && <span className="badge accent">HALAL</span>}
                              {s.ter != null      && <span className="badge mono">{(s.ter * 100).toFixed(2)}%</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Suggestions rapides si pas de saisie */}
                    {!query && etfs.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {['CW8', 'PSP5', 'VWCE', 'IWDA', 'CSPX', 'PANX'].map(t => {
                          const e = etfs.find(x => x.ticker === t);
                          if (!e) return null;
                          return (
                            <button key={t} className="btn sm" onClick={() => pickEtf(e)}>{t}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="dim mono" style={{ fontSize: 11, marginTop: 6 }}>
                  {estReferentiel ? 'ETF du référentiel · simulation persistée en BDD'
                                  : etfSelected ? 'ETF Yahoo Finance · simulation calculée à la volée'
                                                 : 'Cherche par ticker, nom ou indice'}
                </div>
              </div>

              <div className="field">
                <label className="label">Capital initial</label>
                <div className="input-affix">
                  <input className="input" type="number" min="0" step="100"
                    value={capitalInitial} onChange={e => setCapitalInitial(+e.target.value || 0)} />
                  <span className="affix">€</span>
                </div>
              </div>

              <div className="field">
                <label className="label">Versement mensuel</label>
                <div className="input-affix">
                  <input className="input" type="number" min="0" step="50"
                    value={versementMensuel} onChange={e => setVersementMensuel(+e.target.value || 0)} />
                  <span className="affix">€ / mois</span>
                </div>
              </div>

              <div className="field">
                <label className="label">Période</label>
                <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {[3, 5, 10, 15, 20].map(n => {
                    const matchD = dateDebut === yearsAgo(n);
                    const matchF = dateFin === today();
                    return (
                      <button key={n}
                        className={'btn sm' + (matchD && matchF ? ' primary' : '')}
                        onClick={() => { setDateDebut(yearsAgo(n)); setDateFin(today()); }}
                      >{n} ans</button>
                    );
                  })}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" type="date" value={dateDebut} style={{ flex: 1 }}
                    onChange={e => setDateDebut(e.target.value)} />
                  <span className="dim">→</span>
                  <input className="input" type="date" value={dateFin} style={{ flex: 1 }}
                    onChange={e => setDateFin(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <label className="label">
                  TER {etfSelected && estReferentiel && (
                    <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      · référentiel {((etfSelected.ter ?? 0) * 100).toFixed(2)} %
                    </span>
                  )}
                  {etfSelected && !estReferentiel && (
                    <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      · TER non connu, à saisir
                    </span>
                  )}
                </label>
                <div className="input-affix">
                  <input className="input" type="number" min="0" step="0.0001"
                    value={ter ?? 0} onChange={e => setTer(+e.target.value || 0)} />
                  <span className="affix">décimal</span>
                </div>
              </div>

              <div className="divider" style={{ margin: '6px 0' }}></div>

              <div className="col" style={{ gap: 10 }}>
                <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showNoFees} onChange={e => setShowNoFees(e.target.checked)} />
                  <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>Courbe sans frais (référence)</span>
                </label>
                <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showLivretA} onChange={e => setShowLivretA(e.target.checked)} />
                  <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>Livret A (référence sans risque)</span>
                </label>
              </div>

              <button
                className="btn primary"
                style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
                onClick={runBacktest}
                disabled={running || !etfSelected}
              >
                {running ? <><span className="spinner"></span> Simulation…</> : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Lancer le backtest
                </>}
              </button>

              {!etfSelected && (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                  Sélectionne d'abord un ETF
                </div>
              )}
            </div>
          )}

          {/* Projection form */}
          {mode === 'projection' && (
            <div className="panel-body sim-form">
              <div className="field">
                <label className="label">Capital initial</label>
                <div className="input-affix">
                  <input className="input" type="number" min="0" step="100"
                    value={capitalInitial} onChange={e => setCapitalInitial(+e.target.value || 0)} />
                  <span className="affix">€</span>
                </div>
              </div>

              <div className="field">
                <label className="label">Versement mensuel</label>
                <div className="input-affix">
                  <input className="input" type="number" min="0" step="50"
                    value={versementMensuel} onChange={e => setVersementMensuel(+e.target.value || 0)} />
                  <span className="affix">€ / mois</span>
                </div>
              </div>

              <div className="field">
                <label className="label">
                  Rendement annuel attendu
                  <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}> · MSCI World ~7-10 %/an</span>
                </label>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="dim mono" style={{ fontSize: 11 }}>0 %</span>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg-0)' }}>{(tauxAnnuel * 100).toFixed(1)} %<span className="dim" style={{ fontSize: 13, fontWeight: 400 }}>/an</span></span>
                  <span className="dim mono" style={{ fontSize: 11 }}>20 %</span>
                </div>
                <input className="range" type="range" min="0" max="0.20" step="0.005"
                  value={tauxAnnuel} onChange={e => setTauxAnnuel(+e.target.value)} />
              </div>

              <div className="field">
                <label className="label">TER annuel</label>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="dim mono" style={{ fontSize: 11 }}>0 %</span>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg-0)' }}>{(terProj * 100).toFixed(2)} %</span>
                  <span className="dim mono" style={{ fontSize: 11 }}>2 %</span>
                </div>
                <input className="range" type="range" min="0" max="0.020" step="0.0005"
                  value={terProj} onChange={e => setTerProj(+e.target.value)} />
              </div>

              <div className="field">
                <label className="label">Durée de la projection</label>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="dim mono" style={{ fontSize: 11 }}>1 an</span>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-0)' }}>{nbAnnees}<span className="dim" style={{ fontSize: 13, fontWeight: 400 }}> ans</span></span>
                  <span className="dim mono" style={{ fontSize: 11 }}>40 ans</span>
                </div>
                <input className="range" type="range" min="1" max="40" step="1"
                  value={nbAnnees} onChange={e => setNbAnnees(+e.target.value)} />
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                  {[5, 10, 20, 30, 40].map(y => (
                    <button key={y} className={'btn sm' + (nbAnnees === y ? ' primary' : '')} onClick={() => setNbAnnees(y)}>{y}</button>
                  ))}
                </div>
              </div>

              <button className="btn primary" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }} onClick={runProjection} disabled={running}>
                {running ? <><span className="spinner"></span> Calcul…</> : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Projeter
                </>}
              </button>
            </div>
          )}

          {error && (
            <div style={{ margin: '0 16px 16px', padding: 10, border: '1px solid oklch(0.72 0.16 28 / 0.4)', borderRadius: 4, color: 'var(--neg)', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* ====== RIGHT: results ====== */}
        <div className="col" style={{ gap: 18 }}>
          {mode === 'backtest' && <BacktestResult result={resultB} running={running} ticker={ticker}
                                                  showLivretA={showLivretA} showNoFees={showNoFees} ter={ter}
                                                  etfSelected={etfSelected} />}
          {mode === 'projection' && <ProjectionResult result={resultP} running={running} />}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// BACKTEST result
// =============================================================
function BacktestResult({ result, running, ticker, showLivretA, showNoFees, ter, etfSelected }) {
  const metrics = result?.metriques;
  const avecTer = result?.avec_ter || [];
  const sansTer = result?.sans_ter || [];
  const livretA = result?.livret_a || [];

  if (!etfSelected && !running) {
    return (
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <div style={{ color: 'var(--fg-3)', fontSize: 14, textAlign: 'center' }}>
          Sélectionne un ETF dans le formulaire pour lancer le backtest.
        </div>
      </div>
    );
  }

  return (
    <>
      {running ? <KpiSkeleton /> : metrics && (
        <div className="kpi-row fade-in">
          <div className="kpi">
            <div className="kpi-label">Capital total versé</div>
            <div className="kpi-value">{fmtEUR(metrics.capital_verse, { decimals: 0 })}</div>
            <div className="kpi-sub">sur <b>{metrics.nb_annees} ans</b> · {metrics.nb_mois} mois</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Valeur finale (avec frais)</div>
            <div className="kpi-value">{fmtEUR(metrics.valeur_finale, { decimals: 0 })}</div>
            <div className="kpi-sub">
              <span className={'delta ' + (metrics.gain_net >= 0 ? 'pos' : 'neg')}>
                {metrics.gain_net >= 0 ? '▲ +' : '▼ '}{fmtEUR(metrics.gain_net, { decimals: 0 })}
              </span>
              <span className="dim">gain net</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">CAGR (avec frais)</div>
            <div className="kpi-value" style={{ color: metrics.cagr_pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {metrics.cagr_pct.toFixed(2)}<span className="unit">%/an</span>
            </div>
            <div className="kpi-sub">perf. cumulée <b>{metrics.rendement_pct.toFixed(2)} %</b></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Frais cumulés (TER)</div>
            <div className="kpi-value" style={{ color: 'var(--warn)' }}>
              {fmtEUR(metrics.frais_cumules, { decimals: 0 })}
            </div>
            <div className="kpi-sub">
              <span className="delta neg">▼ {fmtEUR(metrics.impact_ter, { decimals: 0 })}</span>
              <span className="dim">vs sans frais</span>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">
            <span className="panel-eyebrow">Courbe</span>
            Évolution du portefeuille · {ticker}
          </div>
          <div className="legend">
            <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--fg-0)' }}></span>Avec frais (TER)</span>
            {showNoFees && <span className="lg-item"><span className="lg-swatch dashed" style={{ color: 'var(--accent)' }}></span>Sans frais</span>}
            {showLivretA && <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--series-3)' }}></span>Livret A {metrics ? `${metrics.livret_a_taux_pct} %` : ''}</span>}
          </div>
        </div>
        <div style={{ padding: '8px 16px' }}>
          {running ? <div className="skeleton" style={{ height: 340 }}></div> : avecTer.length > 0 ? (
            <LineChart
              dates={avecTer.map(p => p.date)}
              series={[
                showLivretA ? { name: 'Livret A',   data: livretA.map(p => p.valeur), color: 'var(--series-3)', width: 1.4, format: v => fmtEUR(v, { compact: true, decimals: 0 }) } : null,
                showNoFees  ? { name: 'Sans frais', data: sansTer.map(p => p.valeur), color: 'var(--accent)',   width: 1.4, dashed: true, format: v => fmtEUR(v, { compact: true, decimals: 0 }) } : null,
                { name: 'Avec frais', data: avecTer.map(p => p.valeur), color: 'var(--fg-0)', width: 1.8, format: v => fmtEUR(v, { compact: true, decimals: 0 }) },
              ].filter(Boolean)}
              height={340}
              yFormat={v => fmtEUR(v, { compact: true, decimals: 0 })}
            />
          ) : (
            <div style={{ padding: 40, color: 'var(--fg-3)', textAlign: 'center' }}>Lance une simulation.</div>
          )}
        </div>

        {avecTer.length > 0 && metrics && (
          <div style={{ borderTop: '1px solid var(--line-1)' }}>
            <div className="row" style={{ padding: '10px 16px', justifyContent: 'space-between' }}>
              <span className="dim mono" style={{ fontSize: 11 }}>Derniers points de la simulation</span>
              <span className="dim mono" style={{ fontSize: 11 }}>{avecTer.length} lignes au total</span>
            </div>
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th className="num">Valeur portefeuille</th><th className="num">Parts cumulées</th><th className="num">Frais cumulés</th></tr>
              </thead>
              <tbody>
                {avecTer.slice(-4).map(r => (
                  <tr key={r.date}>
                    <td className="mono">{fmtDate(r.date, 'long')}</td>
                    <td className="num">{fmtEUR(r.valeur, { decimals: 2 })}</td>
                    <td className="num">{r.parts?.toFixed(4) ?? '·'}</td>
                    <td className="num" style={{ color: 'var(--warn)' }}>{fmtEUR(r.frais_cumules, { decimals: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {metrics && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title"><span className="panel-eyebrow">Récap</span>Stratégies en regard</div>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Stratégie</th><th className="num">Valeur finale</th><th className="num">Gain net</th><th className="num">Δ vs DCA</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>DCA · {ticker} avec frais ({metrics.ter_annuel_pct} %)</td>
                <td className="num">{fmtEUR(metrics.valeur_finale, { decimals: 2 })}</td>
                <td className="num" style={{ color: metrics.gain_net >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{metrics.gain_net >= 0 ? '+' : ''}{fmtEUR(metrics.gain_net, { decimals: 2 })}</td>
                <td className="num dim">référence</td>
              </tr>
              <tr>
                <td>DCA · sans frais</td>
                <td className="num">{fmtEUR(metrics.valeur_sans_ter, { decimals: 2 })}</td>
                <td className="num" style={{ color: 'var(--pos)' }}>+{fmtEUR(metrics.valeur_sans_ter - metrics.capital_verse, { decimals: 2 })}</td>
                <td className="num" style={{ color: 'var(--pos)' }}>+{fmtEUR(metrics.impact_ter, { decimals: 2 })}</td>
              </tr>
              <tr>
                <td>Livret A {metrics.livret_a_taux_pct} %/an</td>
                <td className="num">{fmtEUR(metrics.valeur_livret_a, { decimals: 2 })}</td>
                <td className="num" style={{ color: (metrics.valeur_livret_a - metrics.capital_verse) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {(metrics.valeur_livret_a - metrics.capital_verse) >= 0 ? '+' : ''}{fmtEUR(metrics.valeur_livret_a - metrics.capital_verse, { decimals: 2 })}
                </td>
                <td className="num" style={{ color: metrics.gain_vs_livret >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {metrics.gain_vs_livret >= 0 ? '+' : ''}{fmtEUR(metrics.gain_vs_livret, { decimals: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// =============================================================
// PROJECTION result
// =============================================================
function ProjectionResult({ result, running }) {
  const m = result?.metriques;
  const proj = result?.projection || [];

  return (
    <>
      {running ? <KpiSkeleton /> : m && (
        <div className="kpi-row fade-in">
          <div className="kpi">
            <div className="kpi-label">Capital total investi</div>
            <div className="kpi-value">{fmtEUR(m.capital_total_investi, { decimals: 0 })}</div>
            <div className="kpi-sub">initial <b>{fmtEUR(m.capital_initial, { decimals: 0 })}</b> + versements</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Valeur finale</div>
            <div className="kpi-value">{fmtEUR(m.valeur_finale, { decimals: 0 })}</div>
            <div className="kpi-sub">
              <span className="delta pos">▲ +{fmtEUR(m.interets_composes, { decimals: 0 })}</span>
              <span className="dim">intérêts composés</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">CAGR · {m.nb_annees} ans</div>
            <div className="kpi-value" style={{ color: 'var(--pos)' }}>
              {m.cagr_pct.toFixed(2)}<span className="unit">%/an</span>
            </div>
            <div className="kpi-sub">perf. cumulée <b>{m.performance_cumulee_pct.toFixed(1)} %</b></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Gain vs Livret A</div>
            <div className="kpi-value" style={{ color: m.gain_vs_livret >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {m.gain_vs_livret >= 0 ? '+' : ''}{fmtEUR(m.gain_vs_livret, { compact: true, decimals: 1 })}
            </div>
            <div className="kpi-sub">vs <b>{fmtEUR(m.valeur_livret_a, { compact: true, decimals: 1 })}</b> ({m.livret_a_taux_pct} %)</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">
            <span className="panel-eyebrow">Projection</span>
            Évolution sur {m?.nb_annees || '·'} ans
          </div>
          <div className="legend">
            <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--fg-0)' }}></span>Composés ({m?.taux_annuel_pct ?? '·'} %/an)</span>
            <span className="lg-item"><span className="lg-swatch dashed" style={{ color: 'var(--info)' }}></span>Simples</span>
            <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--series-3)' }}></span>Livret A</span>
            <span className="lg-item"><span className="lg-swatch" style={{ background: 'var(--fg-3)' }}></span>Capital investi</span>
          </div>
        </div>
        <div style={{ padding: '8px 16px' }}>
          {running ? <div className="skeleton" style={{ height: 340 }}></div> : proj.length > 0 ? (
            <LineChart
              dates={proj.map(p => String(new Date().getFullYear() + p.annee))}
              series={[
                { name: 'Capital investi', data: proj.map(p => p.capital_investi), color: 'var(--fg-3)', width: 1.3, format: v => fmtEUR(v, { compact: true, decimals: 0 }) },
                { name: 'Livret A',         data: proj.map(p => p.valeur_livret),   color: 'var(--series-3)', width: 1.4, format: v => fmtEUR(v, { compact: true, decimals: 0 }) },
                { name: 'Simples',          data: proj.map(p => p.valeur_simples),  color: 'var(--info)', width: 1.4, dashed: true, format: v => fmtEUR(v, { compact: true, decimals: 0 }) },
                { name: 'Composés',         data: proj.map(p => p.valeur),          color: 'var(--fg-0)', width: 1.8, format: v => fmtEUR(v, { compact: true, decimals: 0 }) },
              ]}
              height={340}
              yFormat={v => fmtEUR(v, { compact: true, decimals: 0 })}
              yMinHint={0}
            />
          ) : (
            <div style={{ padding: 40, color: 'var(--fg-3)', textAlign: 'center' }}>Configure et projette.</div>
          )}
        </div>
      </div>

      {m && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title"><span className="panel-eyebrow">Récap</span>Composés vs simples vs Livret A</div>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Scénario</th><th className="num">Valeur finale</th><th className="num">Intérêts générés</th><th className="num">% du portefeuille</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>DCA composé · {m.taux_annuel_pct} %/an</td>
                <td className="num">{fmtEUR(m.valeur_finale, { decimals: 0 })}</td>
                <td className="num" style={{ color: 'var(--pos)' }}>+{fmtEUR(m.interets_composes, { decimals: 0 })}</td>
                <td className="num">{m.part_gains_dans_valeur_pct.toFixed(1)} %</td>
              </tr>
              <tr>
                <td>Intérêts simples · {m.taux_annuel_pct} %/an</td>
                <td className="num">{fmtEUR(m.valeur_simples, { decimals: 0 })}</td>
                <td className="num" style={{ color: 'var(--pos)' }}>+{fmtEUR(m.interets_simples, { decimals: 0 })}</td>
                <td className="num">{m.interets_simples_pct.toFixed(1)} %</td>
              </tr>
              <tr>
                <td>Livret A · {m.livret_a_taux_pct} %</td>
                <td className="num">{fmtEUR(m.valeur_livret_a, { decimals: 0 })}</td>
                <td className="num">{fmtEUR(m.valeur_livret_a - m.capital_total_investi, { decimals: 0 })}</td>
                <td className="num">·</td>
              </tr>
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-1)', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--fg-0)' }}>Intérêts composés</strong> = capitalisation des gains chaque mois (simulation DCA réelle).
            <strong style={{ color: 'var(--fg-0)' }}> Intérêts simples</strong> = même taux mais sans capitalisation (référence linéaire).
            L'écart entre les deux courbes illustre l'<em>effet boule de neige</em> de la capitalisation.
          </div>
        </div>
      )}
    </>
  );
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
