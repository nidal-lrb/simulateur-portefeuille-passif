/* ============================================================
   TELOS · App entry (react-router + Shell layout)
   Remplace l'ancien App.jsx
   ============================================================ */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell          from './components/Shell.jsx';
import ExplorerPage   from './pages/ExplorerPage.jsx';
import SimulatorPage  from './pages/SimulatorPage.jsx';
import RegressionPage from './pages/RegressionPage.jsx';
import GuidePage      from './pages/GuidePage.jsx';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/"             element={<ExplorerPage />} />
          <Route path="/etf/:ticker"  element={<ExplorerPage />} />
          <Route path="/compare"      element={<ExplorerPage compareMode />} />
          <Route path="/simulation"   element={<SimulatorPage />} />
          <Route path="/regression"   element={<RegressionPage />} />
          <Route path="/guide"        element={<GuidePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
