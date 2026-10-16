"""Smoke tests: the environment works and the model contract is importable."""

import pandas as pd

import fbml
from fbml import config
from fbml.models.base import MARKETS, PREDICTION_COLUMNS, Model


def test_package_imports():
    assert fbml.__version__


def test_data_dirs_exist():
    assert config.RAW_DIR.is_dir()
    assert config.PROCESSED_DIR.is_dir()


def test_model_contract_is_checkable():
    class Uniform:
        """Example only: a model that gives every selection the same probability."""

        name = "uniform"

        def fit(self, matches: pd.DataFrame) -> None:
            pass

        def predict(self, fixtures: pd.DataFrame) -> pd.DataFrame:
            rows = [
                {"match_id": m, "market": market, "selection": s, "prob": 1 / len(sels)}
                for m in fixtures["match_id"]
                for market, sels in MARKETS.items()
                for s in sels
            ]
            return pd.DataFrame(rows, columns=PREDICTION_COLUMNS)

    model = Uniform()
    assert isinstance(model, Model)
    out = model.predict(pd.DataFrame({"match_id": [1, 2]}))
    assert list(out.columns) == list(PREDICTION_COLUMNS)
    assert (out.groupby(["match_id", "market"])["prob"].sum().round(9) == 1).all()


def test_ml_stack_imports():
    import lightgbm  # noqa: F401
    import scipy.optimize  # noqa: F401
    import sklearn  # noqa: F401
    import statsmodels.api  # noqa: F401
