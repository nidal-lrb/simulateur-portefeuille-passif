/* ============================================================
   TELOS · Command palette (⌘K)
   ============================================================ */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/index.js';

const ROUTES = [
  { id: '/',           label: 'Explorateur ETF',          kbd: '1' },
  { id: '/simulation', label: 'Simulateur DCA',           kbd: '2' },
  { id: '/regression', label: 'Régression linéaire',      kbd: '3' },
  { id: '/guide',      label: 'Guide de l\'investisseur', kbd: 'G' },
];

export default function CommandPalette({ onClose }) {
  const [q, setQ] = useState('');
  const [etfs, setEtfs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api.listeETF()
      .then(r => { if (alive) setEtfs(Array.isArray(r) ? r : []); })
      .catch(() => { /* silent · local API may be down */ });
    return () => { alive = false; };
  }, []);

  const filteredEtfs = etfs.filter(e =>
    !q ||
    e.ticker?.toLowerCase().includes(q.toLowerCase()) ||
    e.nom?.toLowerCase().includes(q.toLowerCase()) ||
    e.nom_long_yf?.toLowerCase().includes(q.toLowerCase())
  );

  const filteredRoutes = ROUTES.filter(r => !q || r.label.toLowerCase().includes(q.toLowerCase()));

  function pickEtf(ticker) {
    navigate('/etf/' + ticker);
    onClose();
  }

  function pickRoute(path) {
    navigate(path);
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'oklch(0.08 0.005 240 / 0.55)',
        display: 'grid', placeItems: 'flex-start center', paddingTop: '12vh', zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, background: 'var(--bg-1)', border: '1px solid var(--line-2)',
          borderRadius: 10, boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
        }}
      >
        <div className="row" style={{ padding: 14, borderBottom: '1px solid var(--line-1)', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--fg-3)' }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher un ETF ou une page…"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              fontSize: 14, color: 'var(--fg-0)',
            }}
          />
          <span className="cmdk-kbd">esc</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filteredRoutes.length > 0 && (
            <div>
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                Pages
              </div>
              {filteredRoutes.map(r => (
                <div
                  key={r.id}
                  onClick={() => pickRoute(r.id)}
                  className="row"
                  style={{ padding: '10px 14px', cursor: 'pointer', gap: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ flex: 1, fontSize: 13 }}>{r.label}</span>
                  <span className="cmdk-kbd">{r.kbd}</span>
                </div>
              ))}
            </div>
          )}
          {filteredEtfs.length > 0 && (
            <div style={{ borderTop: filteredRoutes.length ? '1px solid var(--line-1)' : 'none' }}>
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>
                ETF disponibles
              </div>
              {filteredEtfs.map(e => (
                <div
                  key={e.id ?? e.ticker}
                  onClick={() => pickEtf(e.ticker)}
                  className="row"
                  style={{ padding: '10px 14px', cursor: 'pointer', gap: 10 }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                >
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{e.ticker}</span>
                  <span className="muted" style={{ flex: 1, fontSize: 12 }}>{e.nom}</span>
                  {e.eligible_pea && <span className="badge pea">PEA</span>}
                  {e.is_halal && <span className="badge accent">HALAL</span>}
                  {e.ter != null && <span className="mono dim" style={{ fontSize: 11 }}>{(e.ter * 100).toFixed(2)}%</span>}
                </div>
              ))}
            </div>
          )}
          {filteredRoutes.length === 0 && filteredEtfs.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>Aucun résultat</div>
          )}
        </div>
      </div>
    </div>
  );
}
