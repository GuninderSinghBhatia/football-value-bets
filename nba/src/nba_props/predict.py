"""Handoff contract (roadmap section 6): the only model entry point the web pipeline may call."""

from functools import lru_cache

import numpy as np
import pandas as pd

from .config import EV_THRESHOLD, LIVE_DIR, MODEL_PATH
from .features import FEATURES
from .model import PointsModel
from .odds import american_to_decimal, ev

LIVE_FEATURES_PATH = LIVE_DIR / "tonight_features.parquet"


@lru_cache(maxsize=1)
def _model(mtime: float) -> PointsModel:
    return PointsModel.load(MODEL_PATH)


@lru_cache(maxsize=1)
def _live_features(mtime: float) -> pd.DataFrame:
    return pd.read_parquet(LIVE_FEATURES_PATH).set_index(["player_id", "game_id"])


def load_model() -> PointsModel:
    return _model(MODEL_PATH.stat().st_mtime)


def live_features() -> pd.DataFrame:
    return _live_features(LIVE_FEATURES_PATH.stat().st_mtime)


def decide(model: PointsModel, features_row: pd.Series, line: float, over_odds: float,
           under_odds: float) -> dict:
    """Prediction, P(over), EV for both sides and the pick for one feature row."""
    X = model.clip(features_row[FEATURES].to_frame().T.astype(float))
    pred = max(float(model.predict(X)[0]), 0.0)
    p_over = float(model.p_over(pred, line)[0])
    ev_over = float(ev(p_over, american_to_decimal(over_odds)))
    ev_under = float(ev(1 - p_over, american_to_decimal(under_odds)))
    pick = None
    best = max(ev_over, ev_under)
    if best > EV_THRESHOLD:  # at most one side per player per game
        pick = "over" if ev_over >= ev_under else "under"
    return {
        "predicted_points": round(pred, 2),
        "sd": round(float(model.sd(pred)[0]), 2),
        "line": float(line),
        "p_over": round(p_over, 4),
        "p_under": round(1 - p_over, 4),
        "ev_over": round(ev_over, 4),
        "ev_under": round(ev_under, 4),
        "pick": pick,
        "model_version": model.version,
    }


def predict_player_points(player_id: int, game_id: str, line: float,
                          over_odds: int, under_odds: int) -> dict:
    """Contract from the roadmap. Raises KeyError if the player-game has no feature row and
    ValueError if the player doesn't have enough history (fewer than 10 earlier games)."""
    row = live_features().loc[(int(player_id), str(game_id))]
    if not np.isfinite(row[FEATURES].astype(float)).all():
        raise ValueError(f"player {player_id} lacks the 10-game history the model needs")
    return {"player_id": int(player_id), "game_id": str(game_id),
            **decide(load_model(), row, line, over_odds, under_odds)}
