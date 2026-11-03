# BetMind: Football Value Bets

**Estimate match probabilities, compare them with bookmaker odds, and surface the bets where the model sees value. Paper trading only, no real money.**

BetMind is a machine-learning and web-app project that builds its own football database, trains models to predict match outcomes, and flags *value bets*: bets where the model's probability is higher than the bookmaker's odds imply. It then tracks its own results so it can learn from its mistakes.

## How it works

1. **Ingest** match data and odds from free sources into a local database.
2. **Build features** from team form, results and odds history.
3. **Predict** outcome probabilities (home / draw / away) with models that all share one interface.
4. **Evaluate honestly** with a walk-forward backtest, using the bookmaker's no-vig odds as the bar to beat. Metrics: log loss, Brier score and ranked probability score (RPS).
5. **Find value**: compare model probability against bookmaker odds, and paper-trade the difference.
6. **Learn from results**: log every prediction and outcome, and review what went wrong.

## Project status

- **Model 1 (La Liga 1X2):** built first and judged a failure, so it is being redone a different way.
- **Model 2 (NBA player points props):** a pivot to predicting a player's points in their next game (linear regression, then XGBoost, using home/away, opponent and similar features) and comparing with prop odds, paper traded.
- **Web app:** a Next.js dashboard for upcoming matches, odds and value bets, with a sport switcher planned for football, tennis, UFC, baseball and cricket.

Failures are kept on purpose: `docs/experiments.md` logs every model tried and its scores, and `docs/decisions.md` explains why each tool or approach was chosen.

## Repository layout

| Path | Purpose |
| --- | --- |
| `web/` | Next.js frontend |
| `src/fbml/` | Python package for data, models and evaluation |
| `src/fbml/ingest, db, pipeline, api` | Data loading, storage, scheduled jobs, backend |
| `src/fbml/features, models, eval, betting` | Features, models, backtesting, value-bet maths |
| `src/fbml/models/base.py` | The interface every model implements |
| `notebooks/` | Exploration only, numbered (`01_eda.ipynb`, ...) |
| `tests/` | pytest suite |
| `docs/` | `decisions.md` (why X over Y) and `experiments.md` (every model and its scores) |

## Tech stack

Python 3.12 · uv · pandas · scikit-learn · LightGBM · SHAP · MLflow · pytest · ruff · Jupyter · Next.js

## Getting started

### ML environment

Needs [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv` on Windows). uv installs the right Python (3.12) by itself.

```bash
git clone https://github.com/GuninderSinghBhatia/football-value-bets.git
cd football-value-bets
uv sync              # create .venv with every dependency from uv.lock
uv run pytest        # tests
uv run ruff check .  # lint
uv run ruff format . # format
uv run jupyter lab   # notebooks (pick the "Python (fbml)" kernel)
```

In VS Code, select the interpreter at `.venv`. Notebooks can then import `fbml` directly. Copy `.env.example` to `.env` for API keys. Data downloads go to `data/` (not committed).

### Web app

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000.

## Disclaimer

This is a learning and research project. It does not place real bets and is not betting or financial advice.
