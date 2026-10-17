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
