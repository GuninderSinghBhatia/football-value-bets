"""Unit tests for the NBA props package: odds maths, Phase 8/9 metrics, P(over) model."""

import numpy as np
import pandas as pd
import pytest
from nba_props.evaluate import bet_summary, bootstrap_roi, clv_for_bet, gate2, max_drawdown
from nba_props.model import PointsModel
from nba_props.odds import american_to_decimal, ev, no_vig_over


def test_american_to_decimal():
    assert american_to_decimal(150) == pytest.approx(2.5)
    assert american_to_decimal(-110) == pytest.approx(1 + 100 / 110)


def test_no_vig_sums_to_one():
    over = no_vig_over(american_to_decimal(-110), american_to_decimal(-110))
    assert over == pytest.approx(0.5)


def test_ev():
    assert ev(0.55, 2.0) == pytest.approx(0.10)


def test_max_drawdown():
    assert max_drawdown([1, 1, -1, -1, -1, 2]) == pytest.approx(3)
    assert max_drawdown([-1, -1]) == pytest.approx(2)
    assert max_drawdown([]) == 0


def test_bootstrap_contains_mean():
    profits = np.r_[np.full(55, 0.91), np.full(45, -1.0)]
    lo, hi = bootstrap_roi(profits)
    assert lo < profits.mean() < hi


def test_gate2_perfect_model_passes():
    df = pd.DataFrame({
        "predicted_points": [30.0, 10.0], "line": [20.5, 20.5], "over_odds": [-110, -110],
        "under_odds": [-110, -110], "p_over": [0.9, 0.1], "actual_points": [30, 10],
    })
    g = gate2(df)
    assert g["n"] == 2 and g["model_mae"] == 0 and g["passes"]


def test_bet_summary():
    bets = pd.DataFrame({
        "status": ["won", "lost", "void", "open"], "profit": [0.9, -1.0, 0.0, np.nan],
        "clv": [0.05, -0.02, np.nan, np.nan], "ev": [0.1, 0.06, 0.07, 0.08],
        "start_time": ["2026-10-21", "2026-10-22", "2026-10-22", "2026-10-23"],
    })
    s = bet_summary(bets)
    assert s["settled"] == 2 and s["won"] == 1 and s["void"] == 1 and s["open"] == 1
    assert s["roi"] == pytest.approx(-0.05)


def test_clv_same_line():
    # bet over at +100 (2.0); line closes at -120 / +100 -> no-vig P(over) ~0.522
    clv = clv_for_bet("over", 20.5, 2.0, 20.5, -120, 100, lambda line: 0.5)
    assert clv > 0


def test_clv_line_moved_toward_us():
    # over at 20.5; close moved to 21.5 at even odds. The model says P(over 20.5) - P(over 21.5) = 0.07
    p = {20.5: 0.57, 21.5: 0.50}
    clv = clv_for_bet("over", 20.5, 1.91, 21.5, -110, -110, lambda line: p[line])
    assert clv == pytest.approx(0.57 * 1.91 - 1)


def test_p_over_uses_bucket_residuals():
    resid = {k: np.sort(np.arange(-5, 6, dtype=float)) for k in range(10)}  # symmetric residuals
    m = PointsModel(regressor=None, edges=np.arange(1, 10, dtype=float), resid_by_bucket=resid)
    assert m.p_over(20.0, 20.0)[0] == pytest.approx(6 / 11)   # residual >= 0: 0..5 (x.5 lines never tie)
    assert m.p_over(20.0, 30.0)[0] == 0
