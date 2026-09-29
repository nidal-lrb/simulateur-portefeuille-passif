"""
Point d'entrée FastAPI.
Lance avec : uvicorn main:app --reload
Swagger      : http://localhost:8000/docs
"""

import os
import json
import time
import datetime
import requests as req
import yfinance as yf
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import ETF, Simulation, ResultatSimulation, ResultatRegression
from simulation import simuler_dca, projeter_dca_future, LIVRET_A_TAUX
from pydantic import BaseModel
from regression import compute_regression

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Simulateur de Portefeuille Passif",
    description="API du projet DATA — M2 MIAGE 2025-2026",
    version="0.4.0",
)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOTS_HALAL = ["islamic", "shariah", "sharia", "halal", "sukuk", "wahed"]

REFERENTIEL_PATH = Path(__file__).parent / "referentiel.json"
with open(REFERENTIEL_PATH, encoding="utf-8") as f:
    ETF_REFERENTIELS = json.load(f)

# ── Cache en mémoire pour les données yfinance ───────────────────────────────
# Premier appel = lent (yfinance). Appels suivants dans l'heure = instantanés.
_cache: dict = {}
_TTL = 3600  # secondes


class RegressionBody(BaseModel):
    """Corps de la requête POST /regression/"""
    ticker: str
    fenetre_annees: int = 10


def detecter_halal(nom: str) -> bool:
    return any(mot in nom.lower() for mot in MOTS_HALAL)


def enrichir_depuis_yfinance(ticker_yf: str) -> dict:
    try:
        info = yf.Ticker(ticker_yf).info
        nom_long = info.get("longName") or ""
        return {
            "nom_long_yf":     nom_long if nom_long else None,
            "gestionnaire":    info.get("fundFamily"),
            "indice_replique": info.get("category"),
        }
    except Exception:
        return {"nom_long_yf": None, "gestionnaire": None, "indice_replique": None}


def telecharger_historique(ticker_yf: str, date_debut: str, date_fin: str = None) -> list:
    date_fin_eff = date_fin or datetime.date.today().isoformat()

    try:
        if datetime.date.fromisoformat(date_debut).year < 1990:
            return []
    except (ValueError, TypeError):
        return []

    # Plage incohérente : début >= fin → yfinance crashe, on court-circuite.
    if date_debut >= date_fin_eff:
        return []

    cle = f"{ticker_yf}|{date_debut}|{date_fin_eff}"
    entree = _cache.get(cle)
    if entree and time.time() - entree["ts"] < _TTL:
        return entree["data"]

    try:
        df = yf.download(ticker_yf, start=date_debut, end=date_fin_eff, auto_adjust=True, progress=False)
    except Exception:
        # YFTzMissingError, ValueError sur dates invalides, timeout réseau, etc.
        return []

    if df.empty:
        return []

    df.columns = df.columns.get_level_values(0)

    # Filtre les lignes avec NaN sur Close avant sérialisation JSON.
    # float(NaN) est valide en Python mais casse le JSON et le frontend.
    df.dropna(subset=["Close"], inplace=True)
    if df.empty:
        return []

    data = [
        {"date": str(d.date()), "prix_cloture_ajuste": float(row["Close"])}
        for d, row in df.iterrows()
    ]
    _cache[cle] = {"data": data, "ts": time.time()}
    return data


def _valider_rendement(val, max_abs=2.0):
    if val is None:
        return None
    return val if abs(val) <= max_abs else None


def _fetch_details(ticker_yf: str) -> dict:
    try:
        info = yf.Ticker(ticker_yf).info
        return {
            "aum":             info.get("totalAssets"),
            "volume_moyen":    info.get("averageVolume"),
            "dernier_cours":   info.get("previousClose") or info.get("regularMarketPreviousClose"),
            "semaine_52_haut": info.get("fiftyTwoWeekHigh"),
            "semaine_52_bas":  info.get("fiftyTwoWeekLow"),
            "ytd_return":      _valider_rendement(info.get("ytdReturn"), max_abs=2.0),
            "rendement_3ans":  _valider_rendement(info.get("threeYearAverageReturn"), max_abs=1.5),
            "rendement_5ans":  _valider_rendement(info.get("fiveYearAverageReturn"), max_abs=1.5),
            "devise":          info.get("currency"),
            "beta":            info.get("beta3Year"),
        }
    except Exception:
        return {}


def rechercher_yfinance_api(query: str) -> list:
    try:
        resp = req.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": 20, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5,
        )
        if not resp.ok:
            return []
        quotes = resp.json().get("quotes", [])
        return [
            {
                "ticker":          qt["symbol"].upper(),
                "ticker_yf":       qt["symbol"],
                "nom":             qt.get("longname") or qt.get("shortname") or qt["symbol"],
                "nom_long_yf":     qt.get("longname"),
                "gestionnaire":    None,
                "indice_replique": None,
                "is_halal":        detecter_halal(qt.get("longname") or qt.get("shortname") or ""),
                "ter":             None,
                "eligible_pea":    None,
            }
            for qt in quotes
            if qt.get("quoteType") in ("ETF", "MUTUALFUND")
        ]
    except Exception:
        return []


@app.on_event("startup")
def seed_etf():
    db = next(get_db())
    for data in ETF_REFERENTIELS:
        existe = db.query(ETF).filter(ETF.ticker == data["ticker"]).first()
        if not existe:
            meta = enrichir_depuis_yfinance(data["ticker_yf"])
            etf = ETF(
                ticker=data["ticker"],
                ticker_yf=data["ticker_yf"],
                nom=data["nom"],
                ter=data["ter"],
                eligible_pea=data["eligible_pea"],
                is_halal=data["is_halal"],
                nom_long_yf=meta["nom_long_yf"],
                gestionnaire=meta["gestionnaire"],
                indice_replique=meta["indice_replique"],
            )
            db.add(etf)
    db.commit()
    db.close()


# ─── Santé ──────────────────────────────────────────────

@app.get("/", tags=["Santé"])
def racine():
    return {"status": "ok"}


# ─── ETF ────────────────────────────────────────────────

@app.get("/etf/", tags=["ETF"])
def liste_etf(halal: bool = None, db: Session = Depends(get_db)):
    """Liste tous les ETF. Filtre optionnel : ?halal=true."""
    query = db.query(ETF)
    if halal is not None:
        query = query.filter(ETF.is_halal == halal)
    return query.all()


@app.get("/etf/{ticker}", tags=["ETF"])
def fiche_etf(ticker: str, db: Session = Depends(get_db)):
    """Fiche complète d'un ETF (métadonnées)."""
    etf = db.query(ETF).filter(ETF.ticker == ticker.upper()).first()
    if not etf:
        raise HTTPException(status_code=404, detail=f"ETF '{ticker}' introuvable.")
    return etf


@app.get("/etf/{ticker}/historique", tags=["ETF"])
def historique_etf(
    ticker: str,
    date_debut: str = "2015-01-01",
    date_fin: str = None,
    db: Session = Depends(get_db),
):
    """Série temporelle des cours (prix de clôture ajustés)."""
    etf = db.query(ETF).filter(ETF.ticker == ticker.upper()).first()
    if not etf:
        raise HTTPException(status_code=404, detail=f"ETF '{ticker}' introuvable.")
    hist = telecharger_historique(etf.ticker_yf, date_debut, date_fin)
    if not hist:
        raise HTTPException(status_code=502, detail=f"Aucune donnée pour '{etf.ticker_yf}'.")
    return hist


@app.get("/etf/{ticker}/details", tags=["ETF"])
def details_etf(ticker: str, db: Session = Depends(get_db)):
    """Détails enrichis depuis yfinance (AUM, 52 semaines, rendements)."""
    etf = db.query(ETF).filter(ETF.ticker == ticker.upper()).first()
    if not etf:
        raise HTTPException(status_code=404, detail=f"ETF '{ticker}' introuvable.")
    return _fetch_details(etf.ticker_yf)


# ─── Recherche ──────────────────────────────────────────

@app.get("/search", tags=["Recherche"])
def rechercher(q: str, db: Session = Depends(get_db)):
    """Recherche par ticker, nom ou gestionnaire. Fallback yfinance si non trouvé en base."""
    terme = f"%{q.lower()}%"
    db_resultats = db.query(ETF).filter(
        ETF.ticker.ilike(terme) |
        ETF.nom.ilike(terme) |
        ETF.nom_long_yf.ilike(terme) |
        ETF.gestionnaire.ilike(terme)
    ).all()

    db_dicts = [
        {
            "id":              etf.id,
            "ticker":          etf.ticker,
            "ticker_yf":       etf.ticker_yf,
            "nom":             etf.nom,
            "nom_long_yf":     etf.nom_long_yf,
            "gestionnaire":    etf.gestionnaire,
            "indice_replique": etf.indice_replique,
            "is_halal":        etf.is_halal,
            "ter":             etf.ter,
            "eligible_pea":    etf.eligible_pea,
        }
        for etf in db_resultats
    ]

    yf_resultats = rechercher_yfinance_api(q)
    db_tickers = {d["ticker"].upper() for d in db_dicts}
    yf_uniquement = [r for r in yf_resultats if r["ticker"] not in db_tickers]
    resultats = db_dicts + yf_uniquement

    if not resultats:
        raise HTTPException(status_code=404, detail=f"Aucun ETF trouvé pour '{q}'.")
    return resultats


@app.get("/explore/{ticker_yf}/historique", tags=["Recherche"])
def historique_explore(ticker_yf: str, date_debut: str = "2015-01-01", date_fin: str = None):
    """Historique pour un ETF hors référentiel (ticker Yahoo Finance direct)."""
    hist = telecharger_historique(ticker_yf, date_debut, date_fin)
    if not hist:
        raise HTTPException(status_code=404, detail=f"Aucune donnée pour '{ticker_yf}'.")
    return hist


@app.get("/explore/{ticker_yf}/details", tags=["Recherche"])
def details_explore(ticker_yf: str):
    """Détails yfinance pour un ETF hors référentiel."""
    return _fetch_details(ticker_yf)


# ─── Simulation DCA — Backtesting ───────────────────────

@app.post("/simulation/", tags=["Simulation"])
def creer_simulation(
    ticker: str,
    ticker_yf: str = None,
    capital_initial: float = 0,
    versement_mensuel: float = 100,
    date_debut: str = "2015-01-01",
    date_fin: str = None,
    ter_override: float = None,
    db: Session = Depends(get_db),
):
    """
    Lance un backtesting DCA mensuel sur données historiques réelles.
    ETF du référentiel → résultats persistés en base (exigence CDC §3.3).
    ETF hors référentiel → calcul retourné directement, sans persistance.
    """
    if not date_fin:
        date_fin = datetime.date.today().isoformat()

    etf = db.query(ETF).filter(ETF.ticker == ticker.upper()).first()

    if etf:
        t_yf         = etf.ticker_yf
        ter_effectif = ter_override if ter_override is not None else (etf.ter or 0.0)
        nom_etf      = etf.nom
    else:
        t_yf         = ticker_yf or ticker
        ter_effectif = ter_override if ter_override is not None else 0.0
        nom_etf      = ticker.upper()

    hist = telecharger_historique(t_yf, date_debut, date_fin)
    if not hist:
        raise HTTPException(status_code=502, detail=f"Aucune donnée pour '{t_yf}'.")

    resultat = simuler_dca(
        historique=hist,
        capital_initial=capital_initial,
        versement_mensuel=versement_mensuel,
        ter=ter_effectif,
        date_debut=date_debut,
        date_fin=date_fin,
    )
    if not resultat:
        raise HTTPException(status_code=400, detail="Données insuffisantes sur cette période.")

    simulation_id = None

    if etf:
        sim = Simulation(
            etf_id=etf.id,
            capital_initial=capital_initial,
            versement_mensuel=versement_mensuel,
            date_debut=datetime.date.fromisoformat(date_debut),
            date_fin=datetime.date.fromisoformat(date_fin),
        )
        db.add(sim)
        db.flush()
        for pt in resultat["avec_ter"]:
            db.add(ResultatSimulation(
                simulation_id=sim.id,
                date=datetime.date.fromisoformat(pt["date"]),
                valeur_portefeuille=pt["valeur"],
                parts_cumulees=pt["parts"],
                frais_cumules=pt["frais_cumules"],
            ))
        db.commit()
        simulation_id = sim.id

    return {
        "simulation_id":  simulation_id,
        "persiste":       etf is not None,
        "etf": {
            "ticker":           ticker.upper(),
            "ticker_yf":        t_yf,
            "nom":              nom_etf,
            "ter":              etf.ter if etf else None,
            "ter_utilise":      ter_effectif,
            "dans_referentiel": etf is not None,
        },
        "parametres": {
            "capital_initial":   capital_initial,
            "versement_mensuel": versement_mensuel,
            "date_debut":        date_debut,
            "date_fin":          date_fin,
        },
        **resultat,
    }


@app.get("/simulation/{simulation_id}", tags=["Simulation"])
def get_simulation(simulation_id: int, db: Session = Depends(get_db)):
    """Récupère une simulation stockée et recalcule les 3 courbes (avec TER, sans TER, Livret A)."""
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation #{simulation_id} introuvable.")

    etf = db.query(ETF).filter(ETF.id == sim.etf_id).first()
    hist = telecharger_historique(etf.ticker_yf, str(sim.date_debut), str(sim.date_fin))
    resultat = simuler_dca(
        historique=hist,
        capital_initial=sim.capital_initial,
        versement_mensuel=sim.versement_mensuel,
        ter=etf.ter or 0.0,
        date_debut=str(sim.date_debut),
        date_fin=str(sim.date_fin),
    )

    return {
        "simulation_id": simulation_id,
        "etf": {"ticker": etf.ticker, "nom": etf.nom, "ter": etf.ter},
        "parametres": {
            "capital_initial":   sim.capital_initial,
            "versement_mensuel": sim.versement_mensuel,
            "date_debut":        str(sim.date_debut),
            "date_fin":          str(sim.date_fin),
        },
        **(resultat or {}),
    }


# ─── Simulation DCA — Projection future ─────────────────

@app.post("/simulation/projection/", tags=["Simulation"])
def projeter_dca(
    capital_initial: float = 0,
    versement_mensuel: float = 200,
    taux_annuel: float = 0.07,
    ter: float = 0.002,
    nb_annees: int = 20,
):
    """
    Projection DCA future — calcul théorique pur, sans données historiques.
    Retourne un seul scénario au taux_annuel fourni.
    Inclut la comparaison intérêts composés vs intérêts simples vs Livret A.
    """
    if not (-0.3 <= taux_annuel <= 0.5):
        raise HTTPException(status_code=400, detail="taux_annuel hors plage raisonnable (-30 % à +50 %).")

    resultat = projeter_dca_future(
        capital_initial=capital_initial,
        versement_mensuel=versement_mensuel,
        taux_annuel=taux_annuel,
        ter=ter,
        nb_annees=nb_annees,
    )
    if not resultat:
        raise HTTPException(status_code=400, detail="nb_annees doit être entre 1 et 50.")
    return resultat


# ─── Régression linéaire ────────────────────────────────
#
# IMPORTANT : l'ordre de déclaration des routes compte dans FastAPI/Starlette.
# Les routes littérales DOIVENT être déclarées AVANT les routes paramétrées
# sur le même préfixe, sinon la route littérale ne sera jamais atteinte.

@app.post("/regression/", tags=["Régression"])
def lancer_regression(body: RegressionBody, db: Session = Depends(get_db)):
    """
    Lance une régression OLS sur les cours historiques d'un ETF.
    Retourne les métriques, les séries pour les graphiques, les bandes sigma
    et une projection 12 mois illustrative. Persiste les métriques en BDD.
    Fenêtre : 3 à 15 ans (CDC §2.4).
    """
    if not (3 <= body.fenetre_annees <= 15):
        raise HTTPException(
            status_code=422,
            detail="fenetre_annees doit être entre 3 et 15.",
        )

    etf = db.query(ETF).filter(ETF.ticker == body.ticker.upper()).first()
    if not etf:
        raise HTTPException(status_code=404, detail=f"ETF '{body.ticker}' introuvable.")

    date_debut = (datetime.date.today() - datetime.timedelta(days=body.fenetre_annees * 365)).isoformat()
    hist = telecharger_historique(etf.ticker_yf, date_debut)

    if not hist or len(hist) < 30:
        raise HTTPException(
            status_code=422,
            detail=f"Données insuffisantes pour '{body.ticker}' sur {body.fenetre_annees} an(s).",
        )

    resultat = compute_regression(hist)
    if not resultat:
        raise HTTPException(status_code=500, detail="Calcul de régression échoué.")

    # Upsert — on remplace le résultat précédent pour (etf, fenetre)
    db.query(ResultatRegression).filter(
        ResultatRegression.etf_id == etf.id,
        ResultatRegression.fenetre_annees == body.fenetre_annees,
    ).delete()

    db.add(ResultatRegression(
        etf_id=etf.id,
        fenetre_annees=body.fenetre_annees,
        r2=resultat["r2"],
        pente_jour=resultat["beta1"],
        pente_annualisee_pct=resultat["pente_annualisee_pct"],
        p_value=resultat["p_value"],
        beta0=resultat["beta0"],
    ))
    db.commit()

    return {
        "ticker":         body.ticker.upper(),
        "fenetre_annees": body.fenetre_annees,
        **resultat,
    }

@app.get("/regression/comparaison/", tags=["Régression"])
def comparer_regressions(
    fenetre_annees: int = 10,
    tickers: list[str] = Query(default=["CW8", "PSP5", "ESE", "OBLI"]),
    db: Session = Depends(get_db),
):
    """
    Lance la régression sur une liste d'ETF et retourne une comparaison.
    Par défaut les 4 ETF obligatoires du CDC.
    """
    resultats = []
    for ticker in tickers:
        etf = db.query(ETF).filter(ETF.ticker == ticker.upper()).first()
        if not etf:
            continue
        date_debut = (datetime.date.today() - datetime.timedelta(days=fenetre_annees * 365)).isoformat()
        hist = telecharger_historique(etf.ticker_yf, date_debut)
        if not hist or len(hist) < 30:
            continue
        r = compute_regression(hist)
        if r:
            resultats.append({
                "ticker":               etf.ticker,
                "nom":                  etf.nom,
                "r2":                   r["r2"],
                "pente_annualisee_pct": r["pente_annualisee_pct"],
                "p_value":              r["p_value"],
                "beta1":                r["beta1"],
                "durbin_watson":        r.get("durbin_watson"),
            })
    return resultats


@app.get("/regression/{etf_id}", tags=["Régression"])
def get_regression(etf_id: int, db: Session = Depends(get_db)):
    """Retourne les derniers résultats de régression disponibles pour un ETF."""
    resultats = (
        db.query(ResultatRegression)
        .filter(ResultatRegression.etf_id == etf_id)
        .order_by(ResultatRegression.created_at.desc())
        .all()
    )
    if not resultats:
        raise HTTPException(
            status_code=404,
            detail=f"Aucun résultat de régression pour l'ETF id={etf_id}.",
        )
    return resultats
