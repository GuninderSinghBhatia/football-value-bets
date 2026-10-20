# NBA points model: experiments

| Date | Notebook | Experiment | Result |
|---|---|---|---|
| 2026-10-17 | 02_eda | Points distribution | Right-skewed: mean 10.7 > median 9, max 83; 11% of player-games end with 0 points. Not a bell curve. |
| 2026-10-17 | 02_eda | Points vs minutes | Corr 0.74. Spread grows with minutes (std about 2 at 0–10 min, about 10 at 40+): heteroscedastic. |
| 2026-10-17 | 02_eda | Home vs away | Home +0.12 pts (10.76 vs 10.64) on slightly fewer minutes. Tiny effect. |
| 2026-10-17 | 02_eda | Rest days | Back-to-back 11.37 pts = 2 days' rest 11.37 (selection bias: tired players sit, and DNPs aren't in the data). 4+ days: 7.75 pts / 16.7 min (injury returns, fringe players). |
| 2026-10-17 | 02_eda | Per-player spread (494 players with 100+ games) | Corr(mean, std) = 0.82. Among 20+ ppg: Siakam/Porziņģis/Barrett std 7.0; Curry 9.7, Brunson/Edwards 9.5 (volume 3-pt shooters swing most). |
| 2026-10-17 | 03_features | missing_pts sanity check | Players beat their own last-10 avg by -1.0 (missing ≤ 0), +0.3, +1.1, +1.9, +3.8 pts (missing > 30). Clear monotonic signal. |
| 2026-10-17 | 03_features | Opponent defence sanity check | Points vs own last-10 avg by opponent def-rating quintile: best D −0.20 … worst D +0.39. Real but small (~0.6 pt spread). |
| 2026-10-17 | 03_features | Feature table saved | `features.parquet`: 130,830 rows, 22 features; ~7% NaN (first 10 games per player). Top usage: Dončić 0.33. |
| 2026-10-18 | 04_baselines_lr | Baselines vs linear regression (train 21-22→24-25, test 25-26, NaN rows dropped) | Test MAE: last-10 4.71, season avg 4.72, LinearRegression 4.50 (train 4.54, no overfit). Gate 1 passes on one test season. |
| 2026-10-18 | 04_baselines_lr | Ridge alpha sweep | Test MAE 4.499 (alpha 1 and 100), 4.511 (10k), 4.614 (100k). No gain. |
| 2026-10-18 | 04_baselines_lr | Walk-forward (train on all earlier seasons) | LR MAE 4.48 / 4.53 / 4.50 for test 2023-24 / 2024-25 / 2025-26; beats best baseline by 0.19 / 0.22 / 0.21. Avg LR 4.50 vs season avg 4.71, last-10 4.73. **Gate 1 passed.** Top coefs: season avg 2.71, usage 2.44, missing_pts 1.36, last-10 pts 1.13. |
| 2026-10-18 | 05_xgboost | Calm XGBoost (depth 3, lr 0.03, min_child_weight 50, subsample/colsample 0.8, early stopping on 2024-25) | 432 trees. MAE train 4.487 / valid 4.520 (LR 4.526) / test 4.489 (LR 4.499). Gain ~0.01 pts: no overfit, but no clear win. |
| 2026-10-18 | 06_two_stage | Two-stage (LR minutes × LR pts/min, weighted by minutes), walk-forward | 4.484 / 4.526 / 4.501 vs one-stage 4.482 / 4.526 / 4.499: no gain. XGB minutes model: minutes MAE 4.58 (LR 4.66), points 4.488. |
| 2026-10-18 | 06_two_stage | Oracle: true minutes × predicted rate | 3.71–3.77 MAE (~0.75 better). Error 4.15 when minutes within ±5 of last-10 avg, 5.9 when 10+ off. Minutes are the bottleneck. |
| 2026-10-18 | 07_probabilities | Residuals (train) | sd 5.91, skew +0.53, median −0.58, 5th/95th pct −8.6/+10.5 |
| 2026-10-18 | 07_probabilities | P(over) on 2025-26 vs stand-in lines (last-10 avg → x.5; actual over rate 0.459) | Normal 1 SD: mean 0.504, log loss 0.6642, Brier 0.2360, calib err 0.046. Empirical: 0.471 / 0.6608 / 0.2343 / 0.019. **Empirical by prediction decile: 0.466 / 0.6595 / 0.2338 / 0.015.** Residual sd 3.3 → 8.3 across deciles. High-p bins still a bit over-confident (0.64 pred vs 0.60 actual). |
| 2026-10-20 | train_model.py | Holdout reproduction + production refit on 2021-22..2025-26 | Holdout MAE 4.4992, stand-in log loss 0.6595 (identical to Phases 4/7). 119,631 training rows |
| 2026-10-20 | live pipeline | Opening night 2026-27, 40 DraftKings lines (3 games) | Before the opener fix: every prediction ~6 pts under the line (40/40 unders). After: mean (pred − line) +0.06, mean P(over) 0.476, 22 picks (EV > 5%). Many opening-night gaps are roster-change noise; tagged `season_start` |
