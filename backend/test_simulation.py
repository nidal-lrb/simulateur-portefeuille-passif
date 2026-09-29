"""
Tests unitaires : module B (DCA).
Exécuter : pytest test_simulation.py -v
"""

import pytest
from simulation import simuler_dca, premier_jour_par_mois, LIVRET_A_TAUX

HIST = [
    {"date": f"2024-{str(m).zfill(2)}-01", "prix_cloture_ajuste": 100.0 + m}
    for m in range(1, 13)
]


class TestPremierJourParMois:
    def test_retourne_premier_jour(self):
        hist = [
            {"date": "2024-01-02", "prix_cloture_ajuste": 100.0},
            {"date": "2024-01-10", "prix_cloture_ajuste": 105.0},
            {"date": "2024-02-01", "prix_cloture_ajuste": 110.0},
        ]
        r = premier_jour_par_mois(hist)
        assert r["2024-01"]["date"] == "2024-01-02"
        assert "2024-02" in r

    def test_historique_vide(self):
        assert premier_jour_par_mois([]) == {}


class TestSimulerDCA:
    def test_capital_initial_zero(self):
        """CDC : capital_initial = 0, seulement des versements mensuels."""
        r = simuler_dca(HIST, 0, 100, 0, "2024-01-01", "2024-12-31")
        assert r is not None
        assert r["metriques"]["capital_verse"] == pytest.approx(1200.0, abs=0.01)
        assert r["metriques"]["valeur_finale"] > 0

    def test_ter_zero(self):
        """CDC : TER = 0 → avec_ter == sans_ter."""
        r = simuler_dca(HIST, 0, 200, 0.0, "2024-01-01", "2024-12-31")
        assert r is not None
        for a, s in zip(r["avec_ter"], r["sans_ter"]):
            assert a["valeur"] == pytest.approx(s["valeur"], abs=0.01)

    def test_periode_un_mois(self):
        """CDC : simulation sur un seul mois."""
        h = [{"date": "2024-01-02", "prix_cloture_ajuste": 100.0}]
        r = simuler_dca(h, 1000, 100, 0.005, "2024-01-01", "2024-01-31")
        assert r is not None
        assert len(r["avec_ter"]) == 1
        assert r["metriques"]["capital_verse"] == pytest.approx(1100.0, abs=0.01)

    def test_historique_vide(self):
        assert simuler_dca([], 0, 100, 0, "2024-01-01", "2024-12-31") is None

    def test_ter_reduit_valeur_finale(self):
        """Avec TER > 0 : valeur avec frais < valeur sans frais."""
        r = simuler_dca(HIST, 0, 500, 0.01, "2024-01-01", "2024-12-31")
        assert r["metriques"]["valeur_finale"] < r["metriques"]["valeur_sans_ter"]
        assert r["metriques"]["frais_cumules"] > 0

    def test_livret_a_croissant(self):
        """Livret A doit croître monotonement."""
        r = simuler_dca(HIST, 0, 100, 0, "2024-01-01", "2024-12-31")
        vals = [pt["valeur"] for pt in r["livret_a"]]
        assert all(vals[i] < vals[i + 1] for i in range(len(vals) - 1))

    def test_capital_verse_croissant(self):
        """Capital versé doit croître de `versement_mensuel` chaque mois."""
        r = simuler_dca(HIST, 0, 100, 0, "2024-01-01", "2024-12-31")
        caps = [pt["capital_verse"] for pt in r["avec_ter"]]
        for i in range(1, len(caps)):
            assert caps[i] == pytest.approx(caps[i - 1] + 100, abs=0.01)