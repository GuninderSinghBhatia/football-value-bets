"""Phase 8 (model vs the line) and Phase 9 (value-bet results) metrics."""

import numpy as np
import pandas as pd

from .odds import american_to_decimal, no_vig_over


def gate2(pred: pd.DataFrame) -> dict:
    """Model vs the bookmaker line on the same settled player-games.

    Expects one row per player-game with: predicted_points, line, over_odds, under_odds, p_over,
    actual_points (players who played only). The line is treated as the bookmaker's prediction.
    """
    df = pred.dropna(subset=["predicted_points", "line", "over_odds", "under_odds", "p_over", "actual_points"])
    df = df[df["actual_points"] != df["line"]]  # x.5 lines never push; whole-number lines can
    n = len(df)
    if n == 0:
        return {"n": 0}
    over = (df["actual_points"] > df["line"]).astype(float).to_numpy()
    p_line = no_vig_over(american_to_decimal(df["over_odds"]), american_to_decimal(df["under_odds"]))
    p_model = df["p_over"].clip(1e-4, 1 - 1e-4).to_numpy()

    def logloss(p):
        return float(-np.mean(over * np.log(p) + (1 - over) * np.log(1 - p)))

    out = {
        "n": n,
        "model_mae": float(np.mean(np.abs(df["actual_points"] - df["predicted_points"]))),
        "line_mae": float(np.mean(np.abs(df["actual_points"] - df["line"]))),
        "model_logloss": logloss(p_model),
        "line_logloss": logloss(np.clip(p_line, 1e-4, 1 - 1e-4)),
        "over_rate": float(over.mean()),
        "model_mean_p_over": float(p_model.mean()),
        "line_mean_p_over": float(np.mean(p_line)),
    }
    out["passes"] = bool(out["model_mae"] <= out["line_mae"] and out["model_logloss"] < out["line_logloss"])
    return out


def max_drawdown(profits) -> float:
    """Largest drop from a running peak of cumulative profit (in units, reported as a positive number)."""
    curve = np.cumsum(np.asarray(profits, dtype=float))
    if len(curve) == 0:
        return 0.0
    peak = np.maximum.accumulate(np.concatenate([[0.0], curve]))[1:]
    return float(np.max(peak - curve))


def bootstrap_roi(profits, n_boot: int = 5000, seed: int = 0) -> tuple[float, float]:
    """95% bootstrap interval for ROI per unit staked (flat stakes)."""
    profits = np.asarray(profits, dtype=float)
    if len(profits) < 2:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    samples = rng.choice(profits, size=(n_boot, len(profits)), replace=True).mean(axis=1)
    lo, hi = np.percentile(samples, [2.5, 97.5])
    return float(lo), float(hi)


def bet_summary(bets: pd.DataFrame) -> dict:
    """Results of settled flat-stake paper bets (status won/lost; void bets excluded)."""
    settled = bets[bets["status"].isin(["won", "lost"])].sort_values("start_time")
    n = len(settled)
    profits = settled["profit"].to_numpy(dtype=float)
    clv = settled["clv"].dropna()
    lo, hi = bootstrap_roi(profits)
    return {
        "bets": int(len(bets)),
        "open": int((bets["status"] == "open").sum()),
        "void": int((bets["status"] == "void").sum()),
        "settled": n,
        "won": int((settled["status"] == "won").sum()),
        "win_rate": float((settled["status"] == "won").mean()) if n else None,
        "profit": float(profits.sum()),
        "roi": float(profits.mean()) if n else None,
        "roi_ci95": [lo, hi] if n >= 2 else None,
        "max_drawdown": max_drawdown(profits),
        "avg_clv": float(clv.mean()) if len(clv) else None,
        "positive_clv_share": float((clv > 0).mean()) if len(clv) else None,
        "avg_ev": float(settled["ev"].mean()) if n else None,
    }


def by_period(bets: pd.DataFrame, freq: str = "M") -> pd.DataFrame:
    settled = bets[bets["status"].isin(["won", "lost"])].copy()
    if settled.empty:
        return pd.DataFrame(columns=["period", "bets", "profit", "roi", "avg_clv"])
    period = pd.to_datetime(settled["start_time"], utc=True).dt.tz_localize(None).dt.to_period(freq).astype(str)
    g = settled.groupby(period)
    return pd.DataFrame({
        "bets": g.size(), "profit": g["profit"].sum(), "roi": g["profit"].mean(), "avg_clv": g["clv"].mean(),
    }).rename_axis("period").reset_index()


def clv_for_bet(side: str, bet_line: float, bet_decimal: float, close_line: float,
                close_over_odds: float, close_under_odds: float, model_p_over_at) -> float:
    """Closing line value as the EV of our price under the no-vig closing probability.

    If the line itself moved, the closing probability is shifted back to our bet's line using the
    model's own distribution (model_p_over_at(line) -> P(over)), so a half-point move counts too.
    """
    p_close_over = float(no_vig_over(american_to_decimal(close_over_odds), american_to_decimal(close_under_odds)))
    if close_line != bet_line:
        p_close_over += float(model_p_over_at(bet_line)) - float(model_p_over_at(close_line))
    p_close_over = min(max(p_close_over, 0.01), 0.99)
    p_side = p_close_over if side == "over" else 1 - p_close_over
    return p_side * bet_decimal - 1
