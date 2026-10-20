"""Train the production points model (Phase 11) and save it to nba/models/.

1. Holdout check: fit on 2021-22..2024-25, score 2025-26. Must reproduce Phase 4/7
   (MAE 4.499, bucketed P(over) log loss 0.6595 on stand-in lines).
2. Production fit: all five seasons, saved as nba/models/nba-points-v1.joblib.

Usage:
    .venv/Scripts/python.exe nba/scripts/train_model.py
"""

import json

import numpy as np
from nba_props import model as M
from nba_props.config import MODEL_PATH, MODELS_DIR, TRAIN_SEASONS
from nba_props.data import load_games, load_team_logs
from nba_props.features import FEATURES, TARGET, build_features
from sklearn.metrics import log_loss, mean_absolute_error


def main():
    games = load_games()
    features = build_features(games, load_team_logs())
    features = features[features["season"].isin(TRAIN_SEASONS)].dropna(subset=FEATURES)

    train = features[features["season"] <= 22024]
    test = features[features["season"] == 22025].copy()
    holdout = M.fit(train)
    test["pred"] = holdout.predict(test)
    test["line"] = np.floor(test["points_last10"]) + 0.5  # Phase 7 stand-in line
    p = holdout.p_over(test["pred"], test["line"])
    over = (test[TARGET] > test["line"]).astype(int)
    report = {
        "holdout_test_season": 22025,
        "test_mae": round(mean_absolute_error(test[TARGET], test["pred"]), 4),
        "test_mae_last10": round(mean_absolute_error(test[TARGET], test["points_last10"]), 4),
        "test_mae_season_avg": round(mean_absolute_error(test[TARGET], test["points_season_avg"]), 4),
        "standin_logloss": round(log_loss(over, np.clip(p, 1e-4, 1 - 1e-4)), 4),
        "standin_mean_p_over": round(float(p.mean()), 4),
        "standin_over_rate": round(float(over.mean()), 4),
    }
    print("holdout:", report)

    final = M.fit(features)
    final.save(MODEL_PATH)
    report |= {
        "version": final.version,
        "trained_on": final.trained_on,
        "train_rows": int(len(features)),
        "bucket_edges": np.round(final.edges, 2).tolist(),
        "bucket_sd": [round(float(r.std()), 2) for r in final.resid_by_bucket.values()],
        "coefficients_scaled": dict(sorted(
            zip(FEATURES, np.round(final.regressor[-1].coef_, 3).tolist(), strict=True), key=lambda kv: -abs(kv[1]))),
    }
    (MODELS_DIR / "nba-points-v1.metrics.json").write_text(json.dumps(report, indent=2))
    print("saved ->", MODEL_PATH)


if __name__ == "__main__":
    main()
