"""Points model (Phase 4: scaler -> LinearRegression) and P(over) model (Phase 7: empirical
residuals bucketed by prediction decile)."""

from dataclasses import dataclass, field

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import MODEL_PATH, MODEL_VERSION
from .features import FEATURES, TARGET

N_BUCKETS = 10


@dataclass
class PointsModel:
    regressor: Pipeline
    edges: np.ndarray                       # 9 inner cut points on predicted points
    resid_by_bucket: dict[int, np.ndarray]  # sorted training residuals per bucket
    version: str = MODEL_VERSION
    trained_on: list[int] = field(default_factory=list)
    clip_bounds: dict[str, tuple[float, float]] = field(default_factory=dict)  # training 0.5-99.5 pct

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.regressor.predict(X[FEATURES])

    def clip(self, X: pd.DataFrame) -> pd.DataFrame:
        """Live guard: a linear model extrapolates without limit, so keep inputs in the training range."""
        X = X.copy()
        for col, (lo, hi) in self.clip_bounds.items():
            X[col] = X[col].clip(lo, hi)
        return X

    def buckets(self, pred) -> np.ndarray:
        return np.digitize(np.atleast_1d(pred), self.edges)

    def p_over(self, pred, line) -> np.ndarray:
        """Share of this prediction bucket's past residuals bigger than (line - pred)."""
        pred, line = np.atleast_1d(pred).astype(float), np.atleast_1d(line).astype(float)
        out = np.empty(len(pred))
        b = self.buckets(pred)
        for k, resid in self.resid_by_bucket.items():
            m = b == k
            out[m] = 1 - np.searchsorted(resid, line[m] - pred[m]) / len(resid)
        return out

    def sd(self, pred) -> np.ndarray:
        return np.array([self.resid_by_bucket[k].std() for k in self.buckets(pred)])

    def save(self, path=MODEL_PATH):
        joblib.dump(self, path)

    @staticmethod
    def load(path=MODEL_PATH) -> "PointsModel":
        return joblib.load(path)


def fit(train: pd.DataFrame) -> PointsModel:
    """Fit on rows with full history; the residual buckets come from the same rows."""
    train = train.dropna(subset=FEATURES)
    reg = make_pipeline(StandardScaler(), LinearRegression()).fit(train[FEATURES], train[TARGET])
    pred = reg.predict(train[FEATURES])
    resid = train[TARGET].to_numpy() - pred
    edges = np.quantile(pred, np.linspace(0, 1, N_BUCKETS + 1))[1:-1]
    b = np.digitize(pred, edges)
    resid_by_bucket = {k: np.sort(resid[b == k]) for k in range(N_BUCKETS)}
    bounds = {c: (float(train[c].quantile(0.005)), float(train[c].quantile(0.995))) for c in FEATURES}
    return PointsModel(reg, edges, resid_by_bucket, trained_on=sorted(train["season"].unique().tolist()),
                       clip_bounds=bounds)
