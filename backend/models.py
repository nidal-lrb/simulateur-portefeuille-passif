"""
Modèle de données
Chaque classe = une table PostgreSQL
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class ETF(Base):
    __tablename__ = "etf"

    id              = Column(Integer, primary_key=True)
    ticker          = Column(String, unique=True, nullable=False)
    ticker_yf       = Column(String, nullable=False)
    nom             = Column(String, nullable=False)
    nom_long_yf     = Column(String)        # nom complet récupéré depuis yfinance
    indice_replique = Column(String)
    gestionnaire    = Column(String)
    ter             = Column(Float)
    eligible_pea    = Column(Boolean, default=False)  # saisie manuelle — non disponible sur yfinance
    is_halal        = Column(Boolean, default=False)  # détecté automatiquement via nom_long_yf


class CoursHistorique(Base):
    # Les cours viennent de yfinance en direct
    __tablename__ = "cours_historique"

    id                  = Column(Integer, primary_key=True)
    etf_id              = Column(Integer, ForeignKey("etf.id"), nullable=False)
    date                = Column(Date, nullable=False)
    prix_cloture_ajuste = Column(Float, nullable=False)
    volume              = Column(Float)


class Simulation(Base):
    __tablename__ = "simulation"

    id                = Column(Integer, primary_key=True)
    etf_id            = Column(Integer, ForeignKey("etf.id"), nullable=False)
    capital_initial   = Column(Float, nullable=False)
    versement_mensuel = Column(Float, nullable=False)
    date_debut        = Column(Date, nullable=False)
    date_fin          = Column(Date, nullable=False)
    created_at        = Column(DateTime, server_default=func.now())


class ResultatSimulation(Base):
    __tablename__ = "resultat_simulation"

    id                  = Column(Integer, primary_key=True)
    simulation_id       = Column(Integer, ForeignKey("simulation.id"), nullable=False)
    date                = Column(Date, nullable=False)
    valeur_portefeuille = Column(Float)
    parts_cumulees      = Column(Float)
    frais_cumules       = Column(Float)


class ResultatRegression(Base):
    __tablename__ = "resultat_regression"
 
    id                  = Column(Integer, primary_key=True)
    etf_id              = Column(Integer, ForeignKey("etf.id"), nullable=False)
    fenetre_annees      = Column(Integer)
    r2                  = Column(Float)
    pente_jour          = Column(Float)   # β1 en €/jour de trading
    pente_annualisee_pct = Column(Float)  # %/an — ajout nécessaire pour le CDC
    p_value             = Column(Float)
    beta0               = Column(Float)   # intercept — nécessaire pour reconstruire la droite
    created_at          = Column(DateTime, server_default=func.now())