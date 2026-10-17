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
