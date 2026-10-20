# Model card: nba-points-v1

Predicts how many points an NBA player scores in his next game, turns that into P(over line), and compares it with the DraftKings player-points line. **Paper trading only.**

## What it is

| Part | Choice |
|---|---|
| Points model | `StandardScaler → LinearRegression` on 22 pre-game features (Phase 4). XGBoost (Phase 5) and two-stage minutes × rate (Phase 6) were tried and not kept |
| P(over) | Empirical residuals bucketed by predicted-points decile (Phase 7). P(over) = share of the bucket's training residuals ≥ line − prediction |
| Training data | nba_api regular-season logs, 2021-22 to 2025-26, 119,631 player-games with full history |
| Files | `nba/models/nba-points-v1.joblib` (model, buckets, clip bounds), `nba-points-v1.metrics.json` |
| Code | `nba/src/nba_props/` (`features.py`, `model.py`, `predict.py`); rebuild with `nba/scripts/train_model.py` |

## Features (all from games before tip-off)

Player form: points, minutes, FGA, 3PA and FTA over the last 5 and 10 games; season-to-date points. Role: points per minute (last 10), minutes trend (last 5 − last 10), usage share (last 10). Schedule: home, rest days, back-to-back, long rest. Teammates: team points (last 10) and **missing_pts** (the team's usual scoring minus the usual scoring of tonight's players). Opponent: defensive rating and pace (last 10).

Largest scaled coefficients: season average +2.66, usage +2.47, missing_pts +1.36, points last 10 +1.22.

## Results (holdout: train 2021-22 to 2024-25, test 2025-26)

| Measure | Value |
|---|---|
| Test MAE | **4.50** (last-10 average 4.71, season average 4.72) → Gate 1 passed |
| Walk-forward MAE | 4.48 / 4.53 / 4.50 for 2023-24 / 2024-25 / 2025-26 |
| P(over) on stand-in lines (last-10 avg → x.5) | log loss 0.6595, calibration error 1.5 pts |
| vs real bookmaker lines (Gate 2) | **not measured yet**: no free historical prop lines. Measured forward from 2026-27 in `08_vs_line_backtest.ipynb` |

## Live use

- Lines: DraftKings "Total Points" via ESPN's free API (open + current), polled by `nba/scripts/run_pipeline.py`.
- Who plays: nba_api current rosters, minus players ESPN's injury report lists as **Out**, top 10 by recent minutes plus every player with a line.
- Opening games: no season average yet, so last season's is used, and the ~190-day summer break is treated as normal rest (2 days). Bets on these games carry `season_start = true`.
- Every input is clipped to the training 0.5-99.5 percentile range; a linear model extrapolates without limit.
- Pick: the side with EV = P × decimal − 1 above **5%**, at most one per player per game, 1 unit flat.

## Known weaknesses

1. **Minutes are the bottleneck.** With true minutes, MAE drops to ~3.7. The model doesn't know about starting-lineup changes, minutes restrictions or blowout risk (no game spread feature yet).
2. **Injury report is coarse.** Only "Out" is used; "Day-To-Day" and "Questionable" players are assumed to play, and late scratches after the last run are missed.
3. **Roster changes.** Early in a season, last-10 form and usage come from last season, often on another team. Expect big model-vs-line gaps in the first ~10 games. Treat those picks as noise (Model 1 lesson).
4. **Skewed errors at the top.** High-probability bins were slightly over-confident on the stand-in test (0.64 predicted vs 0.60 actual).
5. **One book.** Only DraftKings prices are live; the OddsPapi logger keeps Pinnacle/FanDuel history for later comparison.
6. **Name matching.** ESPN → nba_api players are matched by normalised name. Unmatched players are skipped (`skip_reason`).
