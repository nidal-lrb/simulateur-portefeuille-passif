# Telos — Simulateur de Portefeuille Passif

> Application web pédagogique pour explorer des ETF, simuler une stratégie DCA et analyser une tendance financière par régression linéaire.

🔗 **Application en ligne :** https://simulateur-portefeuille-passif.vercel.app

---

## Liens du projet

| Ressource | URL |
|---|---|
| Application frontend | https://simulateur-portefeuille-passif.vercel.app |
| API backend | https://simulateur-portefeuille-passif-production.up.railway.app |
| Documentation Swagger | https://simulateur-portefeuille-passif-production.up.railway.app/docs |

---

## Présentation

**Telos** est une application web pédagogique consacrée à l’investissement passif. Elle combine un référentiel interne d’ETF, des données de marché récupérées via Yahoo Finance et plusieurs modules d’analyse permettant de comprendre le fonctionnement d’un portefeuille long terme.

L’application permet à l’utilisateur de :

- rechercher et consulter des ETF ;
- analyser des données historiques de marché ;
- simuler une stratégie d’investissement programmé en DCA ;
- comparer une stratégie ETF avec un placement plus sécurisé de type Livret A ;
- visualiser l’impact des frais annuels ;
- étudier une tendance financière à l’aide d’une régression linéaire.

Les résultats affichés sont produits à des fins pédagogiques et ne constituent pas un conseil en investissement.

---

## Fonctionnalités principales

### Module A — Explorateur ETF

L’explorateur permet de consulter les ETF présents dans le référentiel interne et de rechercher des tickers externes disponibles via Yahoo Finance.

Informations affichées :

- nom de l’ETF ;
- ticker interne ;
- ticker Yahoo Finance ;
- gestionnaire ;
- indice répliqué lorsque disponible ;
- TER, c’est-à-dire les frais annuels ;
- éligibilité PEA ;
- indication halal lorsque disponible ;
- cours et informations de marché récupérés via Yahoo Finance.

L’application contient actuellement **75 ETF référencés**. Le nombre de jours de trading affiché peut varier selon le ticker sélectionné, car il dépend des observations journalières réellement disponibles dans Yahoo Finance. Pour une période d’environ trois ans, on obtient généralement autour de **760 jours de cotation**, ce qui est cohérent avec les calendriers boursiers.

---

### Module B — Simulateur DCA

Le simulateur permet de tester une stratégie d’investissement programmé, aussi appelée **Dollar-Cost Averaging**.

Paramètres configurables :

- ETF du référentiel ou ticker externe Yahoo Finance ;
- capital initial ;
- versement mensuel ;
- période d’investissement ;
- TER, pré-rempli depuis le référentiel lorsque l’ETF est connu ;
- hypothèses de projection future.

Résultats produits :

- évolution historique du portefeuille ;
- montant total investi ;
- valeur finale du portefeuille ;
- gain ou perte réalisé ;
- comparaison avec un placement Livret A ;
- effet des frais annuels ;
- projection future selon un rendement hypothétique ;
- distinction entre intérêts simples et intérêts composés.

L’objectif est de montrer concrètement comment une stratégie d’investissement régulier peut évoluer dans le temps.

---

### Module C — Régression linéaire

Le module de régression linéaire permet d’analyser une tendance sur une série temporelle de prix.

Il fonctionne avec :

- un ETF du référentiel ;
- un ticker externe disponible via Yahoo Finance.

Résultats produits :

- graphique du cours historique ;
- droite de régression ;
- intervalle de confiance à 95 % ;
- graphique des résidus ;
- coefficient de détermination R² ;
- pente de la tendance ;
- p-value ;
- statistique de Durbin-Watson ;
- projection illustrative à 12 mois.

Cette partie permet d’illustrer l’usage d’un modèle statistique simple sur des données financières réelles.

---

## Architecture du projet

```txt
project/
├── backend/
│   ├── main.py          # Routes API FastAPI et orchestration
│   ├── database.py      # Connexion SQLAlchemy et session PostgreSQL
│   ├── models.py        # Modèles ORM
│   ├── simulation.py    # Moteur de simulation DCA
│   ├── regression.py    # Calculs de régression linéaire
│   ├── requirements.txt
│   ├── Procfile         # Commande de démarrage Railway
│   └── railway.toml     # Configuration Railway
│
└── frontend/
    ├── src/             # Pages et composants React
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── vercel.json      # Redirection React Router vers index.html
```

---

## Stack technique

### Frontend

- React
- Vite
- JavaScript
- CSS
- React Router
- Déploiement sur Vercel

### Backend

- Python
- FastAPI
- SQLAlchemy
- Uvicorn
- PostgreSQL
- pandas, NumPy et SciPy pour les traitements de données
- Déploiement sur Railway

### Données

- Référentiel interne d’ETF stocké en PostgreSQL
- Données historiques récupérées via `yfinance`
- Données de marché issues de Yahoo Finance

---

## API

La documentation interactive de l’API est disponible ici :

```txt
https://simulateur-portefeuille-passif-production.up.railway.app/docs
```

Endpoints principaux :

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/` | Vérification de l’état du backend |
| GET | `/etf/` | Liste des ETF du référentiel |
| GET | `/etf/{ticker}` | Détail d’un ETF |
| GET | `/etf/{ticker}/historique` | Historique de prix |
| GET | `/etf/{ticker}/details` | Informations complémentaires via Yahoo Finance |
| GET | `/search?q=` | Recherche dans le référentiel et via Yahoo Finance |
| POST | `/simulation/` | Simulation DCA |
| POST | `/simulation/projection/` | Projection future |
| POST | `/regression/` | Régression linéaire |
| GET | `/regression/comparaison/` | Comparaison de plusieurs ETF |

---

## Lancement local

### Backend

Depuis le dossier `backend/` :

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend local :

```txt
http://127.0.0.1:8000
```

Documentation Swagger locale :

```txt
http://127.0.0.1:8000/docs
```

---

### Frontend

Depuis le dossier `frontend/` :

```bash
npm install
npm run dev
```

Frontend local :

```txt
http://localhost:5173
```

---

## Variables d’environnement

### Backend Railway

```env
DATABASE_URL=...
ALLOWED_ORIGINS=https://simulateur-portefeuille-passif.vercel.app,http://localhost:5173
```

`DATABASE_URL` permet au backend de se connecter à la base PostgreSQL Railway.

`ALLOWED_ORIGINS` permet d’autoriser le frontend Vercel à appeler l’API FastAPI sans blocage CORS.

---

### Frontend Vercel

```env
VITE_API_URL=https://simulateur-portefeuille-passif-production.up.railway.app
```

Pour un lancement local, cette variable peut être remplacée par :

```env
VITE_API_URL=http://127.0.0.1:8000
```

---

## Déploiement

### Backend — Railway

Le backend est déployé depuis le dossier `backend/`.

Commande de démarrage :

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Railway fournit automatiquement la variable `$PORT`.

La base PostgreSQL est hébergée dans le même projet Railway que le backend.

---

### Frontend — Vercel

Le frontend est déployé depuis le dossier `frontend/`.

Configuration Vercel :

```txt
Framework Preset : Vite
Build Command    : npm run build
Output Directory : dist
```

Le fichier `vercel.json` permet de rediriger les routes React vers `index.html`, afin d’éviter les erreurs 404 lors d’un rafraîchissement sur une page interne.

---

## Checklist avant démonstration

Avant une présentation, vérifier que :

- l’application frontend est accessible ;
- le backend répond sur `/docs` ;
- l’endpoint `/etf/` retourne la liste des ETF ;
- l’explorateur charge les ETF du référentiel ;
- la recherche Yahoo Finance fonctionne ;
- le simulateur fonctionne avec un ETF du référentiel ;
- le simulateur fonctionne avec un ticker externe ;
- la régression fonctionne avec un ETF du référentiel ;
- la régression fonctionne avec un ticker externe ;
- les graphiques s’affichent correctement.

---

## Limites connues

- Les résultats ne constituent pas un conseil en investissement.
- Les données de marché dépendent de la disponibilité de Yahoo Finance.
- Certains tickers peuvent ne pas retourner de données exploitables selon la place de cotation ou la période.
- Le nombre de jours de trading peut varier légèrement selon les marchés, les jours fériés et les données disponibles.
- La fiscalité, les frais de courtage et les contraintes propres aux enveloppes fiscales ne sont pas modélisés de manière exhaustive.
- Les projections futures sont illustratives et reposent sur des hypothèses simplificatrices.
- Le CAGR est utile pour donner un ordre de grandeur, mais un TRI serait plus rigoureux pour analyser précisément une stratégie DCA avec versements multiples.

---

## Auteurs

Projet réalisé dans le cadre du **Master 2 MIAGE — Université Paris-Saclay**, année universitaire **2025–2026**.

- Rayan Abansir
- Nidal Larbi
- Pape Adama Sene

Encadrant : Nicolas Legeay