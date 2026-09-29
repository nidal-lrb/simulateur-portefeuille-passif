"""
Module B : simulateur DCA.
Backtesting historique + Projection future.
"""

import datetime
from typing import List, Dict, Optional

# CORRECTION : taux Livret A en vigueur depuis le 1er février 2026.
# Historique : 3 % (fév 2023 à jan 2025) → 2,4 % → 1,7 % → 1,5 % (fév 2026).
LIVRET_A_TAUX = 0.015


def premier_jour_par_mois(historique: List[Dict]) -> Dict[str, Dict]:
    """Retourne {YYYY-MM: point} avec le premier jour de trading de chaque mois."""
    mois: Dict[str, Dict] = {}
    for pt in sorted(historique, key=lambda x: x["date"]):
        cle = pt["date"][:7]
        if cle not in mois:
            mois[cle] = pt
    return mois


def simuler_dca(
    historique: List[Dict],
    capital_initial: float,
    versement_mensuel: float,
    ter: float,
    date_debut: str,
    date_fin: str,
) -> Optional[Dict]:
    """
    Simule une stratégie DCA mensuelle sur données historiques.
    Retourne avec_ter, sans_ter, livret_a et métriques de synthèse.
    """
    if not historique:
        return None

    ter = max(ter or 0.0, 0.0)
    ter_mensuel    = ter / 12
    livret_mensuel = LIVRET_A_TAUX / 12

    tous = premier_jour_par_mois(historique)
    mois_filtres = {
        cle: pt for cle, pt in tous.items()
        if date_debut[:7] <= cle <= date_fin[:7]
    }
    if not mois_filtres:
        return None

    parts_avec    = 0.0
    parts_sans    = 0.0
    frais_cumules = 0.0
    capital_verse = 0.0
    valeur_livret = 0.0

    avec_ter: List[Dict] = []
    sans_ter: List[Dict] = []
    livret_a: List[Dict] = []

    for i, (_, pt) in enumerate(sorted(mois_filtres.items())):
        prix = pt["prix_cloture_ajuste"]
        montant = versement_mensuel + (capital_initial if i == 0 else 0)
        capital_verse += montant

        # Avec TER : conforme CDC §5.2 : valeur × (1 − TER/12)
        parts_avec   += montant / prix
        frais_mois    = parts_avec * prix * ter_mensuel
        parts_avec   -= frais_mois / prix
        frais_cumules += frais_mois

        avec_ter.append({
            "date":          pt["date"],
            "valeur":        round(parts_avec * prix, 2),
            "capital_verse": round(capital_verse, 2),
            "parts":         round(parts_avec, 6),
            "frais_cumules": round(frais_cumules, 2),
        })

        # Sans TER
        parts_sans += montant / prix
        sans_ter.append({"date": pt["date"], "valeur": round(parts_sans * prix, 2)})

        # Livret A : dépôt en début de mois, intérêts en fin de mois
        valeur_livret = (valeur_livret + montant) * (1 + livret_mensuel)
        livret_a.append({"date": pt["date"], "valeur": round(valeur_livret, 2)})

    vf   = avec_ter[-1]["valeur"]
    vf_s = sans_ter[-1]["valeur"]
    vf_l = livret_a[-1]["valeur"]
    cv   = capital_verse

    # CORRECTION : durée depuis les paramètres de simulation, pas depuis les
    # dates des données. Évite de sous-estimer nb_annees d'environ 1 mois.
    d0 = datetime.date.fromisoformat(date_debut)
    d1 = datetime.date.fromisoformat(date_fin)
    nb_annees = max((d1 - d0).days / 365.25, 0.01)

    # CAGR : formule CDC §5.1 : (VF / capital_versé)^(1/n) − 1
    cagr = ((vf / cv) ** (1 / nb_annees) - 1) * 100 if cv > 0 else 0.0

    return {
        "avec_ter": avec_ter,
        "sans_ter": sans_ter,
        "livret_a": livret_a,
        "metriques": {
            "capital_verse":     round(cv, 2),
            "valeur_finale":     round(vf, 2),
            "gain_net":          round(vf - cv, 2),
            "rendement_pct":     round((vf - cv) / cv * 100, 2) if cv > 0 else 0.0,
            "cagr_pct":          round(cagr, 2),
            "frais_cumules":     round(frais_cumules, 2),
            "impact_ter":        round(vf_s - vf, 2),
            "valeur_sans_ter":   round(vf_s, 2),
            "valeur_livret_a":   round(vf_l, 2),
            "gain_vs_livret":    round(vf - vf_l, 2),
            "nb_mois":           len(avec_ter),
            "nb_annees":         round(nb_annees, 1),
            "ter_annuel_pct":    round(ter * 100, 4),
            "livret_a_taux_pct": round(LIVRET_A_TAUX * 100, 2),
        },
    }


def projeter_dca_future(
    capital_initial: float,
    versement_mensuel: float,
    taux_annuel: float,
    ter: float,
    nb_annees: int,
) -> Optional[Dict]:
    """
    Projette un DCA futur sur un seul scénario (taux_annuel fourni).
    capital_initial est inclus dans le capital total investi.
    Calcule les intérêts simples (référence linéaire) et composés (simulation réelle).
    """
    if not (1 <= nb_annees <= 50):
        return None

    ter = max(ter or 0.0, 0.0)
    # Taux mensuel équivalent composé : formule exacte, pas une approximation linéaire
    taux_mensuel   = (1 + taux_annuel) ** (1 / 12) - 1
    ter_mensuel    = ter / 12
    livret_mensuel = LIVRET_A_TAUX / 12
    nb_mois        = nb_annees * 12

    valeur        = float(capital_initial)
    valeur_livret = float(capital_initial)
    points = []

    for mois in range(1, nb_mois + 1):
        # Net mensuel = (1 + taux_mensuel - ter_mensuel)
        # Approximation de (1+r)*(1-f) avec erreur ~r×f par mois, négligeable
        valeur        = (valeur        + versement_mensuel) * (1 + taux_mensuel - ter_mensuel)
        valeur_livret = (valeur_livret + versement_mensuel) * (1 + livret_mensuel)

        if mois % 12 == 0:
            annee           = mois // 12
            capital_investi = capital_initial + versement_mensuel * mois

            # Intérêts simples, capital initial : taux × années
            is_initial = capital_initial * taux_annuel * annee
            # Intérêts simples, versements : chaque versement m investit
            # depuis le mois m jusqu'au mois n, soit (n-m) mois.
            # Somme = taux/12 × (0 + 1 + … + (n-1)) = taux/12 × (n-1)×n/2
            is_contrib = versement_mensuel * taux_annuel / 12 * (mois - 1) * mois / 2
            valeur_simples = capital_investi + is_initial + is_contrib

            points.append({
                "annee":           annee,
                "valeur":          round(valeur, 2),
                "valeur_simples":  round(valeur_simples, 2),
                "valeur_livret":   round(valeur_livret, 2),
                "capital_investi": round(capital_investi, 2),
            })

    if not points:
        return None

    vf            = points[-1]["valeur"]
    vf_simples    = points[-1]["valeur_simples"]
    vf_livret     = points[-1]["valeur_livret"]
    total_contrib = versement_mensuel * nb_mois
    capital_total = capital_initial + total_contrib

    interets_composes = vf - capital_total
    interets_simples  = vf_simples - capital_total
    perf_cumulee      = (vf / capital_total - 1) * 100 if capital_total > 0 else 0.0
    cagr              = ((vf / capital_total) ** (1 / nb_annees) - 1) * 100 if capital_total > 0 else 0.0

    return {
        "projection": points,
        "metriques": {
            "capital_initial":       round(capital_initial, 2),
            "total_contributions":   round(total_contrib, 2),
            "capital_total_investi": round(capital_total, 2),
            "valeur_finale":         round(vf, 2),
            # Gain réel = valeur finale − capital total sorti de poche
            "interets_composes":     round(interets_composes, 2),
            # CORRECTION : renommé depuis interets_composes_pct.
            # Ce ratio (gains / valeur_finale) mesure la part des intérêts dans
            # la valeur finale, différent du taux de rendement (performance_cumulee_pct).
            "part_gains_dans_valeur_pct": round(interets_composes / vf * 100, 2) if vf > 0 else 0.0,
            "interets_simples":      round(interets_simples, 2),
            "interets_simples_pct":  round(interets_simples / vf_simples * 100, 2) if vf_simples > 0 else 0.0,
            "valeur_simples":        round(vf_simples, 2),
            "performance_cumulee_pct": round(perf_cumulee, 2),
            "cagr_pct":              round(cagr, 2),
            "valeur_livret_a":       round(vf_livret, 2),
            "gain_vs_livret":        round(vf - vf_livret, 2),
            "taux_annuel_pct":       round(taux_annuel * 100, 2),
            "ter_pct":               round(ter * 100, 4),
            "nb_annees":             nb_annees,
            "livret_a_taux_pct":     round(LIVRET_A_TAUX * 100, 2),
        },
    }
