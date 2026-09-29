/* ============================================================
   TELOS · Shell (sidebar + topbar) · react-router layout
   ============================================================ */

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import CommandPalette from './CommandPalette.jsx';
import TickerBar from './TickerBar.jsx';

const NAV_PAGES = [
  { path: '/',           label: 'Explorateur ETF',     kbd: '1', section: 'analyse',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> },
  { path: '/simulation', label: 'Simulateur DCA',      kbd: '2', section: 'analyse',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 5-6"/></svg> },
  { path: '/regression', label: 'Régression linéaire', kbd: '3', section: 'analyse',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M3 17 17 5"/><circle cx="7" cy="14" r="1.3" fill="currentColor"/><circle cx="11" cy="11" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/></svg> },
  { path: '/guide',      label: "Guide de l'investisseur", kbd: 'G', section: 'apprendre',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
];

function getCrumb(pathname) {
  if (pathname === '/' || pathname.startsWith('/etf/') || pathname === '/compare') return 'Explorateur ETF';
  if (pathname.startsWith('/simulation')) return 'Simulateur DCA';
  if (pathname.startsWith('/regression')) return 'Régression linéaire';
  if (pathname.startsWith('/guide')) return "Guide de l'investisseur";
  return '';
}

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(p => !p);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      } else if (!paletteOpen && !e.metaKey && !e.ctrlKey && !e.altKey
                 && document.activeElement?.tagName !== 'INPUT'
                 && document.activeElement?.tagName !== 'TEXTAREA'
                 && document.activeElement?.tagName !== 'SELECT') {
        if (e.key === '1') navigate('/');
        else if (e.key === '2') navigate('/simulation');
        else if (e.key === '3') navigate('/regression');
        else if (e.key.toLowerCase() === 'g') navigate('/guide');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, navigate]);

  useEffect(() => {
    document.documentElement.setAttribute('data-telos', '');
    return () => document.documentElement.removeAttribute('data-telos');
  }, []);

  const crumb = getCrumb(location.pathname);

  return (
    <div className="app">
      {/* ============ SIDEBAR ============ */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M5 7 H19 M12 7 V19" stroke="oklch(0.82 0.11 78)" strokeWidth="2.5" strokeLinecap="square" fill="none" />
              <circle cx="12" cy="7" r="1.4" fill="oklch(0.82 0.11 78)" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Telos</div>
            <div className="brand-sub">PASSIVE PORTFOLIO</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Analyse</div>
          {NAV_PAGES.filter(p => p.section === 'analyse').map(p => (
            <NavLink
              key={p.path}
              to={p.path}
              end={p.path === '/'}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <span className="nav-item-icon" style={{ display: 'inline-flex', width: 14, height: 14 }}>{p.icon}</span>
              {p.label}
              <span className="nav-kbd">{p.kbd}</span>
            </NavLink>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-label">Apprendre</div>
          {NAV_PAGES.filter(p => p.section === 'apprendre').map(p => (
            <NavLink
              key={p.path}
              to={p.path}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <span className="nav-item-icon" style={{ display: 'inline-flex', width: 14, height: 14 }}>{p.icon}</span>
              {p.label}
              <span className="nav-kbd">{p.kbd}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-version">
            <span className="dim mono" style={{ fontSize: 11 }}>v0.4.0</span>
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <span className="muted">Telos</span>
            <span className="sep">/</span>
            <span className="here">{crumb}</span>
          </div>
          <div className="topbar-spacer"></div>

          <button className="cmdk" onClick={() => setPaletteOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <span>Rechercher un ETF…</span>
            <span className="cmdk-kbd">⌘K</span>
          </button>
        </header>

        <div className="content">
          <div className="content-inner">
            <Outlet />
          </div>
        </div>

        <TickerBar />
      </main>

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}
