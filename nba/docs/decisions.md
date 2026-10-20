# NBA points model: decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-17 | Switch from La Liga 1X2 to NBA player points | Model 1 couldn't beat an efficient market; props are generally softer |
| 2026-10-17 | Bar to beat = the bookmaker line, not raw accuracy | A good MAE alone doesn't mean profit (Model 1 lesson) |
| 2026-10-17 | Linear regression first, XGBoost second | Simple and stable first; boosting overfit in Model 1 |
| 2026-10-17 | One model for all players | Not enough games per player for separate models |
| 2026-10-17 | Opponent defence instead of "vs this team" | Head-to-head samples are too small and noisy |
| 2026-10-17 | Predict a distribution → P(over) | Betting needs probabilities |
| 2026-10-17 | Live in `nba/` inside the football-value-bets repo | Reuse the uv `.venv` and Jupyter kernel |
| 2026-10-17 | Data: `LeagueGameLog` (nba_api), regular season 2021-22 to 2025-26 | One call per season gets every player-game; 5 seasons as per the roadmap |
| 2026-10-17 | Drop 0-minute rows (461) | They carry no scoring signal and drag down averages |
| 2026-10-17 | Save the clean table as `data/processed/games.parquet` | Keeps dtypes (datetime date, string game_id with leading zeros) |
| 2026-10-17 | Leave `rest_days` NaN for each player's first game | 0 would be a fake value (no same-day games exist) |
| 2026-10-17 | Phase 8 spread must be per player, not one std for all | EDA: std grows with minutes and with the mean (corr 0.82) |
| 2026-10-17 | Infer "who was out" from teammates missing vs the usual rotation | Logs have no DNP rows; back-to-back alone shows no drop because of that selection bias |
| 2026-10-17 | `long_rest` excludes each player's first game of the season | Summer break isn't an injury return |
| 2026-10-17 | `missing_pts` = team_pts_last10 − sum of points_last10 of players who played | No DNP rows; measures usual scoring absent tonight. Uses tonight's lineup, so live use needs the pre-game injury report |
| 2026-10-17 | Usage = player (FGA + 0.44·FTA) / team (FGA + 0.44·FTA), rolling 10 | Box-score proxy; true usage needs play-by-play |
| 2026-10-17 | Opponent defence = points allowed per 100 possessions, rolling 10, from team logs | Pace-adjusted, pre-game only |
| 2026-10-17 | Leave NaNs in features.parquet | Phase 4 decides: drop early games or fall back to last season |
| 2026-10-18 | Prop lines from OddsPapi (free plan), not The Odds API | Free /historical-odds gives the full open→close history per game; only ~10 billable requests a month |
| 2026-10-18 | No backfill of 2025-26 lines | OddsPapi history returned 404 for every January 2026 game tested; Gate 2 will use lines logged from 2026-27 |
| 2026-10-18 | Log Pinnacle + DraftKings + FanDuel (max 3 per historical call) | One sharp book for the "true" line, two big US books for prices people actually get |
| 2026-10-18 | Keep plain LinearRegression over Ridge | Ridge gives no test gain at any alpha; simpler wins |
| 2026-10-18 | Linear regression (test MAE 4.50) is the bar for Phase 5 | XGBoost is kept only if it clearly beats this out of sample |
| 2026-10-18 | Keep linear regression, not XGBoost | XGBoost only 0.01 MAE better on test (4.489 vs 4.499), below the 0.05 "clearly better" bar; LR is faster, explainable and easier to build probabilities on |
| 2026-10-18 | Keep one-stage LR; shelve two-stage | No gain with current features. Revisit once injury-report / starters / spread features exist, since minutes error is the biggest lever (~0.75 MAE) |
| 2026-10-18 | P(over) from empirical residuals bucketed by prediction decile, not a Normal curve | Normal over-rates overs by ~4.5 pts (skew); bucketed empirical has the best calibration, log loss and Brier. Saved to nba/models/prob_model_resid_buckets.npz |
| 2026-10-20 | Gate 2 measured forward (paper trading), not on history | No free historical prop lines; the roadmap allows "paper trade forward and measure" |
| 2026-10-20 | Live lines: DraftKings points props via ESPN's free core API | Free, no request budget, has open + current prices; ESPN doesn't label sides, the over is matched to the "N+ points" milestone price |
| 2026-10-20 | Production model = same LR + residual buckets, refit on all 5 seasons | Holdout run first reproduces Phase 4/7 (MAE 4.499, log loss 0.6595) |
| 2026-10-20 | Live season openers: last season's average, rest_days = 2 | Openers were never in training (season avg NaN). The raw ~190-day rest pushed every prediction ~5.6 pts down |
| 2026-10-20 | Clip live inputs to the training 0.5–99.5 pct range | A linear model extrapolates without limit (e.g. missing_pts −50 after big trades) |
| 2026-10-20 | Who plays = roster − ESPN "Out", top 10 by recent minutes + everyone with a line | Median 10 players per team-game in training; keeps missing_pts on the training scale |
| 2026-10-20 | EV threshold 5%, one bet per player-game, 1 unit flat | Props vig ~4–5% per side; revisit with the 09 threshold sweep |
| 2026-10-20 | CLV = EV of our price under DraftKings' no-vig closing probability, shifted to our line with the model's distribution when the line moved | Counts half-point line moves, not just price changes |
| 2026-10-20 | Web reads JSON exported by the Python pipeline (web/data/nba) | No backend service needed; the web app never imports model code |
