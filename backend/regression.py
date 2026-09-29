"""
Module C — Régression linéaire OLS.
Calcul pur, sans dépendances HTTP ou BDD — même philosophie que simulation.py.

X = numéro du jour de trading (0, 1, ..., N-1), conformément au CDC §5.3.
Y = prix de clôture ajusté.
"""

import numpy as np
from scipy import stats
from datetime import date, timedelta
from typing import List, Dict, Optional


def compute_regression(historique: List[Dict]) -> Optional[Dict]:
    """
    Calcule la régression OLS et tous les affichages dérivés.

    Paramètre
    ---------
    historique : liste de {"date": "YYYY-MM-DD", "prix_cloture_ajuste": float}
                 triée chronologiquement — même format que telecharger_historique().

    Retourne None si données insuffisantes (< 30 points).
    """
    if not historique or len(historique) < 30:
        return None

    dates = [pt["date"] for pt in historique]
    y = np.array([pt["prix_cloture_ajuste"] for pt in historique], dtype=float)
    x = np.arange(len(y), dtype=float)

    n = len(x)
    x_mean = x.mean()
    y_mean = y.mean()

    # Une seule passe scipy donne β1, β0, R, p-value, stderr de β1.
    # Choix retenu face à sklearn+scipy : moins de lignes, moins de risque de
    # désynchronisation entre les différents objets de résultat.
    slope, intercept, r_value, p_value, _ = stats.linregress(x, y)

    r2 = r_value ** 2
    y_hat = intercept + slope * x
    residuals = y - y_hat

    # Durbin-Watson : détecte l'autocorrélation des résidus.
    # DW ≈ 2 → résidus indépendants, DW < 1.5 → autocorrélation positive forte.
    # Sur séries financières on s'attend à DW << 2 (argument pédagogique CDC §2.4).
    dw = float(np.sum(np.diff(residuals) ** 2) / np.sum(residuals ** 2))

    # Erreur standard des résidus — base du calcul des IC (formule OLS standard)
    sse = np.sum(residuals ** 2)
    s   = np.sqrt(sse / (n - 2))       # n-2 degrés de liberté pour OLS simple
    sxx = np.sum((x - x_mean) ** 2)
    t_crit = stats.t.ppf(0.975, df=n - 2)  # t bilatéral 95 %

    ic_hist = _confidence_band(x, x_mean, n, sxx, s, t_crit, y_hat)

    # Pente annualisée : β1 × 252 jours de trading / prix moyen × 100
    # Convention CDC §5.3 : on divise par le prix moyen (y_mean) de la fenêtre.
    pente_annualisee_pct = (slope * 252) / y_mean * 100

    # Projection 12 mois — illustratif uniquement (mention obligatoire CDC §2.4).
    n_proj = 252
    x_proj = np.arange(n, n + n_proj, dtype=float)
    y_proj = intercept + slope * x_proj
    ic_proj = _confidence_band(x_proj, x_mean, n, sxx, s, t_crit, y_proj)

    last_date = date.fromisoformat(dates[-1])
    proj_dates = [(last_date + timedelta(days=i + 1)).isoformat() for i in range(n_proj)]

    # Sous-échantillonnage : Recharts n'a pas besoin de plus de ~400 points
    # pour rendre une courbe continue sur 10+ ans. On garde 1 point sur 5.
    step = max(1, n // 400)
    idx  = list(range(0, n, step))

    return {
        # ── Métriques scalaires — tableau de synthèse CDC §5.3 ──────────
        "beta0":                round(float(intercept), 4),
        "beta1":                round(float(slope), 4),
        "r2":                   round(float(r2), 4),
        "p_value":              float(p_value),
        "pente_annualisee_pct": round(float(pente_annualisee_pct), 2),

        # ── Séries historiques — Graphique 1 (cours + droite + IC) ──────
        "dates":           [dates[i] for i in idx],
        "prix":            [round(float(y[i]),             2) for i in idx],
        "regression_line": [round(float(y_hat[i]),         2) for i in idx],
        "ic_upper":        [round(float(ic_hist["upper"][i]), 2) for i in idx],
        "ic_lower":        [round(float(ic_hist["lower"][i]), 2) for i in idx],

        # ── Bandes d'écart-type des résidus (±1σ / ±2σ / ±3σ) ──────────
        # Différent de l'IC sur la droite : ces bandes montrent où tombent
        # les prix réels (68 % / 95 % / 99,7 % sous hypothèse normale).
        # Pédagogiquement : illustre que les crises (2008, 2020) dépassent ±3σ,
        # prouvant que le market timing est imprévisible — argument pro-DCA.
        "sigma1_upper": [round(float(y_hat[i] + s),     2) for i in idx],
        "sigma1_lower": [round(float(y_hat[i] - s),     2) for i in idx],
        "sigma2_upper": [round(float(y_hat[i] + 2 * s), 2) for i in idx],
        "sigma2_lower": [round(float(y_hat[i] - 2 * s), 2) for i in idx],
        "sigma3_upper": [round(float(y_hat[i] + 3 * s), 2) for i in idx],
        "sigma3_lower": [round(float(y_hat[i] - 3 * s), 2) for i in idx],

        # ── Résidus — Graphique 2 ────────────────────────────────────────
        "durbin_watson": round(dw, 4),
        "residus":       [round(float(residuals[i]), 2) for i in idx],

        # ── Projection 1 point / 5 jours (Recharts, vitesse de rendu) ───
        "projection_dates":    proj_dates[::5],
        "projection_line":     [round(float(v), 2) for v in y_proj[::5]],
        "projection_ic_upper": [round(float(v), 2) for v in ic_proj["upper"][::5]],
        "projection_ic_lower": [round(float(v), 2) for v in ic_proj["lower"][::5]],
    }


def _confidence_band(x_vals, x_mean, n, sxx, s, t_crit, y_hat_vals):
    """
    Bande de confiance à 95 % sur la droite de régression.

    Formule : SE(x) = s × sqrt(1/n + (x − x_mean)² / Sxx)
    Marge    = t_crit × SE(x)

    C'est l'IC sur la moyenne prédite (pas l'intervalle de prédiction ponctuelle).
    Il s'élargit hors de la fenêtre historique — illustration directe de CDC §2.4.
    """
    se     = s * np.sqrt(1 / n + (x_vals - x_mean) ** 2 / sxx)
    margin = t_crit * se
    return {"upper": y_hat_vals + margin, "lower": y_hat_vals - margin}
