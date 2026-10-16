# BetMind

Estimates match probabilities, compares them with bookmaker odds to find value bets, and learns from its results.
**Paper trading only.**

## Structure

- `web/`: Next.js frontend
- `src/fbml/`: Python package for the data, models and evaluation
  - `ingest/`, `db/`, `pipeline/`, `api/`: data loading, storage, scheduled jobs, backend
  - `features/`, `models/`, `eval/`, `betting/`: features, models, backtesting, value-bet maths
  - `models/base.py`: the interface every model implements
- `notebooks/`: exploration only, numbered (`01_eda.ipynb`, ...)
- `tests/`: pytest
- `docs/`: `decisions.md` (why X over Y) and `experiments.md` (every model tried and its scores)

## ML environment

Needs [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv` on Windows). uv installs the right Python (3.12)
by itself.

```bash
uv sync                      # create .venv with every dependency from uv.lock
uv run pytest                # tests
uv run ruff check .          # lint
uv run ruff format .         # format
uv run jupyter lab           # notebooks (pick the "Python (fbml)" kernel)
```

In VS Code, select the interpreter at `.venv` (Python: Select Interpreter). Notebooks can then `import fbml` directly.

Copy `.env.example` to `.env` for API keys. Data downloads go to `data/` (not committed).

## Run the web app

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000.
