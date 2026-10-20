"""Odds maths (roadmap section 3)."""

import numpy as np


def american_to_decimal(odds):
    odds = np.asarray(odds, dtype=float)
    return np.where(odds > 0, 1 + odds / 100, 1 + 100 / np.abs(odds))


def implied(decimal):
    return 1 / np.asarray(decimal, dtype=float)


def no_vig_over(over_decimal, under_decimal):
    """The line's own P(over) once the bookmaker's cut is removed."""
    imp_over, imp_under = implied(over_decimal), implied(under_decimal)
    return imp_over / (imp_over + imp_under)


def ev(p, decimal):
    """Expected profit per 1 unit staked."""
    return np.asarray(p, dtype=float) * np.asarray(decimal, dtype=float) - 1
