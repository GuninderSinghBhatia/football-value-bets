"""The contract every model implements, so the backtester, pipeline and web app can run any of them.

See "The contract between your code and Claude's" in football-ml-detailed-roadmap.md.
"""

from typing import Protocol, runtime_checkable

import pandas as pd

#: Markets a model may price, and their selections.
MARKETS: dict[str, tuple[str, ...]] = {
    "1x2": ("H", "D", "A"),
    "ou25": ("over", "under"),
    "btts": ("yes", "no"),
}

#: Columns `predict` must return (one row per match, market and selection).
PREDICTION_COLUMNS = ("match_id", "market", "selection", "prob")


@runtime_checkable
class Model(Protocol):
    name: str

    def fit(self, matches: pd.DataFrame) -> None:
        """Learn from matches that finished before the prediction time (from `load_matches(as_of=...)`)."""
        ...

    def predict(self, fixtures: pd.DataFrame) -> pd.DataFrame:
        """Return one row per (match_id, market, selection) with column `prob`.

        Within each (match_id, market), the probabilities must sum to 1.
        """
        ...
