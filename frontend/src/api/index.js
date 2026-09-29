const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// CORRECTION : message d'erreur réseau explicite.
// Avant : TypeError: Failed to fetch sans contexte si le backend est down.
async function fetcher(url, options = {}) {
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error('Backend inaccessible — vérifiez que le serveur FastAPI tourne sur ' + API)
  }
  if (!res.ok) throw new Error(`Erreur ${res.status} sur ${url}`)
  return res.json()
}

export const listeETF = (halal = null) =>
  fetcher(halal !== null ? `${API}/etf/?halal=${halal}` : `${API}/etf/`)

export const ficheETF = (ticker) =>
  fetcher(`${API}/etf/${ticker}`)

export const historiqueETF = (ticker, dateDebut = '2015-01-01', dateFin = null) =>
  fetcher(`${API}/etf/${ticker}/historique?date_debut=${dateDebut}${dateFin ? `&date_fin=${dateFin}` : ''}`)

export const detailsETF = (ticker) =>
  fetcher(`${API}/etf/${ticker}/details`)

export const rechercherETF = (q) =>
  fetcher(`${API}/search?q=${encodeURIComponent(q)}`)

// CORRECTION : explorerInfoETF supprimé — doublon exact de rechercherETF.

export const historiqueExplore = (tickerYf, dateDebut = '2015-01-01', dateFin = null) =>
  fetcher(`${API}/explore/${encodeURIComponent(tickerYf)}/historique?date_debut=${dateDebut}${dateFin ? `&date_fin=${dateFin}` : ''}`)

export const detailsExplore = (tickerYf) =>
  fetcher(`${API}/explore/${encodeURIComponent(tickerYf)}/details`)

export const simulerDCA = ({ ticker, capitalInitial, versementMensuel, dateDebut, dateFin, terOverride }) => {
  const params = new URLSearchParams({
    ticker,
    capital_initial:   capitalInitial,
    versement_mensuel: versementMensuel,
    date_debut:        dateDebut,
  })
  if (dateFin != null)      params.append('date_fin',     dateFin)
  if (terOverride != null)  params.append('ter_override', terOverride)
  return fetcher(`${API}/simulation/?${params}`, { method: 'POST' })
}

export const projetterDCA = ({ capitalInitial, versementMensuel, tauxAnnuel, ter, nbAnnees }) => {
  const params = new URLSearchParams({
    capital_initial:   capitalInitial,
    versement_mensuel: versementMensuel,
    taux_annuel:       tauxAnnuel,
    ter,
    nb_annees:         nbAnnees,
  })
  return fetcher(`${API}/simulation/projection/?${params}`, { method: 'POST' })
}

export const getSimulation = (id) =>
  fetcher(`${API}/simulation/${id}`)

export const lancerRegression = ({ ticker, fenetreAnnees }) =>
  fetcher(`${API}/regression/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ticker, fenetre_annees: fenetreAnnees }),
  })

export const getRegression = (etfId) =>
  fetcher(`${API}/regression/${etfId}`)

export const comparerRegressions = (fenetreAnnees = 10, tickers = []) => {
  const params = new URLSearchParams({ fenetre_annees: fenetreAnnees })
  tickers.forEach(t => params.append('tickers', t))
  return fetcher(`${API}/regression/comparaison/?${params}`)
}
