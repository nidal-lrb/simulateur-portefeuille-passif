"""
Tests unitaires : projection DCA future.
Exécuter : pytest test_projection.py -v
"""

import pytest
from simulation import projeter_dca_future, LIVRET_A_TAUX


class TestProjetterDCAFutur:

    def test_croissance_taux_positif(self):
        """Avec un taux positif, la valeur finale doit dépasser le capital versé."""
        r = projeter_dca_future(0, 200, 0.07, 0.002, 10)
        assert r is not None
        assert r["metriques"]["valeur_finale"] > r["metriques"]["capital_total_investi"]

    def test_capital_verse_exact(self):
        """Capital total investi = versement_mensuel x 12 x nb_annees (capital_initial=0)."""
        r = projeter_dca_future(0, 200, 0.07, 0.002, 10)
        assert r["metriques"]["capital_total_investi"] == pytest.approx(200 * 12 * 10, abs=0.01)

    def test_taux_eleve_produit_plus(self):
        """
        CORRECTION : remplace test_optimiste_superieur_central.
        projeter_dca_future calcule un seul scénario (pas 3).
        On vérifie que taux+4% produit une valeur finale supérieure à taux-4%.
        """
        bas  = projeter_dca_future(0, 200, 0.03, 0.002, 20)
        haut = projeter_dca_future(0, 200, 0.11, 0.002, 20)
        assert haut["metriques"]["valeur_finale"] > bas["metriques"]["valeur_finale"]

    def test_ter_zero_pas_d_erosion(self):
        """
        CORRECTION : remplace test_ter_zero_egal_sans_frais.
        La clé valeur_sans n'existe pas dans les points de projection.
        On vérifie que TER=0 ne réduit pas la valeur finale par rapport au capital.
        """
        r = projeter_dca_future(0, 200, 0.07, 0.0, 10)
        assert r["metriques"]["valeur_finale"] > r["metriques"]["capital_total_investi"]

    def test_ter_reduit_valeur(self):
        """
        CORRECTION : remplace la version avec pt["valeur_sans"] inexistante.
        On compare deux appels : avec TER=0 vs TER=1%.
        """
        sans_frais = projeter_dca_future(0, 200, 0.07, 0.0,  10)
        avec_frais = projeter_dca_future(0, 200, 0.07, 0.01, 10)
        assert avec_frais["metriques"]["valeur_finale"] < sans_frais["metriques"]["valeur_finale"]

    def test_livret_croissant(self):
        """Le Livret A doit croître monotonement chaque année."""
        r = projeter_dca_future(0, 100, 0.07, 0.002, 10)
        vals = [pt["valeur_livret"] for pt in r["projection"]]
        assert all(vals[i] < vals[i + 1] for i in range(len(vals) - 1))

    def test_nb_points_par_scenario(self):
        """La projection retourne exactement nb_annees points (un par an)."""
        for n in [5, 10, 20]:
            r = projeter_dca_future(0, 200, 0.07, 0.002, n)
            assert len(r["projection"]) == n

    def test_capital_initial_augmente_valeur(self):
        """
        CORRECTION : remplace valeur_centrale par valeur_finale.
        Un capital initial > 0 produit une valeur finale plus haute.
        """
        sans = projeter_dca_future(0,     200, 0.07, 0.002, 10)
        avec = projeter_dca_future(10000, 200, 0.07, 0.002, 10)
        assert avec["metriques"]["valeur_finale"] > sans["metriques"]["valeur_finale"]

    def test_annees_croissant_dans_points(self):
        """Le champ 'annee' doit être strictement croissant de 1 à nb_annees."""
        r = projeter_dca_future(0, 200, 0.07, 0.002, 10)
        annees = [pt["annee"] for pt in r["projection"]]
        assert annees == list(range(1, 11))

    def test_duree_invalide_retourne_none(self):
        """nb_annees = 0 ou > 50 → None."""
        assert projeter_dca_future(0, 200, 0.07, 0.002, 0)  is None
        assert projeter_dca_future(0, 200, 0.07, 0.002, 51) is None

    def test_versement_zero(self):
        """
        CORRECTION : capital_total_investi inclut capital_initial.
        Avec versement=0 et capital_initial=10000, capital_total_investi = 10000.
        """
        r = projeter_dca_future(10000, 0, 0.07, 0.0, 5)
        assert r is not None
        assert r["metriques"]["capital_total_investi"] == pytest.approx(10_000, abs=0.01)
        assert r["metriques"]["valeur_finale"] > 10_000
