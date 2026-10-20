"""Paths and settings for the NBA points model and its live pipeline."""

from fbml.config import ROOT

NBA_DIR = ROOT / "nba"
RAW_DIR = NBA_DIR / "data" / "raw"
PROCESSED_DIR = NBA_DIR / "data" / "processed"
LIVE_DIR = NBA_DIR / "data" / "live"      # pipeline tables: snapshots, predictions, paper bets
MODELS_DIR = NBA_DIR / "models"
WEB_EXPORT_DIR = ROOT / "web" / "data" / "nba"  # JSON the BetMind web app reads

MODEL_VERSION = "nba-points-v1"
MODEL_PATH = MODELS_DIR / f"{MODEL_VERSION}.joblib"

# seasons in the nba_api SEASON_ID form: 22025 = 2025-26
TRAIN_SEASONS = [22021, 22022, 22023, 22024, 22025]
CURRENT_SEASON = 22026
CURRENT_SEASON_LABEL = "2026-27"

# betting rules (Phase 9)
EV_THRESHOLD = 0.05   # props carry ~4-5% vig per side, so demand a clear edge
STAKE = 1.0           # flat 1-unit paper stakes

for _dir in (LIVE_DIR, MODELS_DIR, WEB_EXPORT_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
