/* ============================================================
   TELOS · TickerBar
   Bandeau scrolling en bas avec perfs 1 an · ETF majeurs seulement
   ============================================================ */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/index.js';

// Seulement les ETF les plus reconnus pour limiter les appels API
const MAJOR_TICKERS = ['CW8', 'PSP5', 'VWCE', 'IWDA', 'CSPX', 'PANX', 'AEEM', 'OBLI', 'SGLD', 'VWRL'];

function fmtPerc(n) {
  if (n == null) return '·';
  const sign = n >= 0 ? '+' : '';
  return sign + (n * 100).toFixed(2) + ' %';
}

function fmtPrice(n) {
  if (n == null) return '·';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function TickerBar() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const etfs = await api.listeETF();
        const list = Array.isArray(etfs) ? etfs : [];
        const major = list.filter(e => MAJOR_TICKERS.includes(e.ticker));

        const oneYearAgo = (() => {
          const d = new Date(); d.setFullYear(d.getFullYear() - 1);
          return d.toISOString().slice(0, 10);
        })();

        const results = await Promise.allSettled(
          major.map(e =>
            api.historiqueETF(e.ticker, oneYearAgo).then(r => {
              const data = Array.isArray(r) ? r : [];
              if (!data.length) return null;
              const last  = data[data.length - 1].prix_cloture_ajuste;
              const first = data[0].prix_cloture_ajuste;
              return { ticker: e.ticker, nom: e.nom, last, perf: last / first - 1 };
            })
          )
        );
        if (!alive) return;
        const ok = results
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value);
        setItems(ok);
      } catch {}
    }
    load();
    return () => { alive = false; };
  }, []);

  if (items.length === 0) {
    return (
      <div className="ticker-bar">
        <div className="ticker-label">PERF 1A</div>
        <div className="ticker-mask">
          <div className="ticker-track">
            <span className="ticker-item dim">Chargement…</span>
          </div>
        </div>
      </div>
    );
  }

  // CORRECTION : key="${ticker}-${i}" au lieu de key={i}.
  // key={i} sur tableau dupliqué créait des clés React dupliquées.
  const loop = [...items, ...items, ...items];

  return (
    <div className="ticker-bar">
      <div className="ticker-label">PERF 1A</div>
      <div className="ticker-mask">
        <div className="ticker-track">
          {loop.map((it, i) => (
            <span
              key={`${it.ticker}-${i}`}
              className="ticker-item"
              onClick={() => navigate('/etf/' + it.ticker)}
              title={it.nom}
            >
              <span className="ticker-ticker">{it.ticker}</span>
              <span className="ticker-price">{fmtPrice(it.last)}</span>
              <span className={'ticker-perf ' + (it.perf >= 0 ? 'pos' : 'neg')}>
                {it.perf >= 0 ? '▲' : '▼'} {fmtPerc(it.perf)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
