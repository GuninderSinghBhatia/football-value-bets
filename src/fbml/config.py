"""Project paths and settings shared by every module and notebook.

Secrets (API keys) live in a `.env` file at the repo root, never in code. See `.env.example`.
"""

from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"  # downloads exactly as received (CSVs, API responses)
PROCESSED_DIR = DATA_DIR / "processed"  # cleaned tables built from raw
MLRUNS_DIR = ROOT / "mlruns"  # MLflow tracking store (Phase 2)
DB_URL = f"sqlite:///{DATA_DIR / 'fbml.db'}"  # local database (Phase 1); Postgres in production

load_dotenv(ROOT / ".env")

for _dir in (RAW_DIR, PROCESSED_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
