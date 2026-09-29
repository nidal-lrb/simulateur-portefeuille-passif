"""
Connexion à PostgreSQL via SQLAlchemy.
Le moteur est créé une seule fois et réutilisé par toute l'application.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Repli local : base SQLite dans le dossier backend si aucun PostgreSQL n'est configuré.
    DATABASE_URL = "sqlite:///" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "local.db")
    print(f"[database] DATABASE_URL absent : utilisation de SQLite local ({DATABASE_URL})")

# Railway/Heroku fournissent parfois "postgres://", refusé par SQLAlchemy 2.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def get_db():
    """
    Générateur de session utilisé par FastAPI.
    Le finally garantit que la session est fermée même en cas d'erreur.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()