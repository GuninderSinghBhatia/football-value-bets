# Notebook 01: what we did so far

`notebooks/01_eda.ipynb` · La Liga · status as of 2026-10-16 · **work in progress**

**Goal:** predict La Liga results (home win / draw / away win) as probabilities, compare them with the bookmakers', and check whether the disagreements would make money. Paper trading only.

**Headline result:** a 3-feature logistic regression is stable (log loss about 0.98 every season) but always a little worse than the market (about 0.96). Betting on its "value" picks loses money.

---

## 1. Data

| Item | Value |
|---|---|
| Source | football-data.co.uk, `mmz4281/<season>/SP1.csv` (free CSVs) |
| Seasons | 2021/22 → 2025/26 (`'2122'` … `'2526'`), added as a `season` column |
| Matches | 1,900 (5 × 380), 162 raw columns |
| Dates | 13 Aug 2021 → 24 May 2026; parsed with format `%d/%m/%Y`, sorted oldest first |

**Odds column choice:** Pinnacle odds (`PSH/PSD/PSA`) are missing for 191 of 380 matches in 2025/26. The market-average odds (`AvgH/AvgD/AvgA`) have **no gaps**, so we use those.

**Match table (`matches`):** `season, date, home, away, home_goals, away_goals, result, odds_home, odds_draw, odds_away`. 0 missing values.

| Result (5 seasons) | Share |
|---|---|
| Home win | 45.7% |
| Draw | 26.2% |
| Away win | 28.1% |

Home teams win far more often than away teams. Any model needs this home advantage.

## 2. Odds baseline (the bar to beat)

- **Implied probability:** `1 / odds` per outcome (`imp_home`, `imp_draw`, `imp_away`).
- **Overround:** the sum of the three, averaging **1.049**, i.e. about a 4.9% bookmaker cut (6.5% in 2025/26 alone).
- **Fair probabilities:** `p_* = imp_* / overround`. Each match sums to 1 (checked).
- **`p_actual`:** the market's probability for what actually happened (via `np.select`).

**Log loss** = mean of −log(probability given to the actual result); lower is better.

| Predictor | Log loss (all 5 seasons) |
|---|---|
| Dumb baseline (same H/D/A guess every match) | 1.067 |
| Market (fair probabilities) | **0.967** |

## 3. Features (all computed from matches *before* kickoff: no leakage)

**Elo ratings** (`elo_home`, `elo_away`):
- Every team starts at 1500; `K = 20`; home bonus `HOME_ADV = 60`.
- Expected home score: `1 / (1 + 10^((R_away − (R_home + 60)) / 400))`.
- Actual score: H = 1, D = 0.5, A = 0.
- Ratings are **recorded before the update** for each match, so the result is never seen.
- **Final ratings:** Barcelona 1774, Real Madrid 1740, Villarreal / Atlético 1628 … Almería 1384, Granada 1354, Valladolid 1315.

**Form** (`form_home`, `form_away`): points from each team's last 5 matches before this one (win 3, draw 1, loss 0; range 0–15).

| Home team's form | Home win | Draw | Away win |
|---|---|---|---|
| 0–4 pts | 37% | 32% | 32% |
| 5–9 pts | 45% | 25% | 30% |
| 10–15 pts | **59%** | 21% | 20% |

**Model inputs:** `elo_diff = elo_home − elo_away`, `form_home`, `form_away`.

## 4. Train / test split (by time, never random)

- **Train:** 2022/23 – 2024/25, 1,140 matches (12 Aug 2022 → 25 May 2025)
- **Test:** 2025/26, 380 matches (15 Aug 2025 → 24 May 2026)
- **2021/22 is excluded:** Elo was still warming up from 1500 that season.

## 5. Models on the 2025/26 test season

| Model | Train log loss | Test log loss |
|---|---|---|
| **Logistic regression** (scaler → LR) | 0.977 | **0.982** |
| Gradient boosting, default settings | 0.434 | 1.237 |
| Gradient boosting, "calm" (depth 3, lr 0.05, 200 trees, ≥ 40 per leaf) | 0.847 | 1.016 |
| Market | – | 0.964 |
| Dumb baseline | – | 1.046 |

- **Logistic regression** closes about 78% of the gap between the dumb baseline and the market.
- **Gradient boosting overfits:** default train 0.43 vs test 1.24, worse than the dumb baseline. The calm settings reduce it but still lose to LR. With 3 features and about 1,100 matches there's nothing non-linear for trees to find. **We keep logistic regression.**

## 6. Walk-forward evaluation (always training only on the past)

| Test season | Train matches | Model | Market | Gap |
|---|---|---|---|---|
| 2023/24 | 380 | 0.977 | 0.949 | 0.028 |
| 2024/25 | 760 | 0.983 | 0.953 | 0.029 |
| 2025/26 | 1,140 | 0.982 | 0.964 | 0.018 |
| **Average** | | **0.981** | **0.956** | **0.025** |

- **Stable:** the 2025/26 result wasn't luck.
- **Always behind the market.**
- **More training data barely helps**, so the features are the limit.

## 7. Value bets + backtest (walk-forward predictions, 1,140 matches)

- **EV** = model probability × odds − 1, for each of H, D and A.
- **Stake:** a flat 1 unit; profit is `odds − 1` if the bet wins, else −1.

| Rule | Bets | Win rate | Profit (units) | ROI |
|---|---|---|---|---|
| Every outcome, no model | 3,420 | 33% | −327 | −9.6% |
| EV > 0% | 1,178 | 36% | −141 | −12.0% |
| EV > 5% | 874 | 33% | −158 | −18.1% |
| EV > 10% | 649 | 32% | −125 | −19.3% |

EV > 5% by season: 2023/24 −23.8%, 2024/25 −27.6%, 2025/26 +3.8% (225 bets, likely noise).

- **It loses money,** and following the model's value picks is worse than betting blindly. When the model disagrees with the market, the market is usually right.
- **The top "value" picks all involve promoted teams** (Las Palmas, Leganés, Almería). They start at Elo 1500 (an average La Liga team), which overrates them.

---

## Known issues / to do

**Modelling**
- [ ] **Promoted teams' Elo:** start them lower (e.g. the average of the just-relegated teams' ratings) instead of 1500.
- [ ] **Richer features:** goals scored/conceded (rolling), home-only and away-only form, rest days, xG.
- [ ] **Calibration:** check reliability plots; try blending the model with market probabilities.
- [ ] **Tune Elo:** `K` and `HOME_ADV` are guesses (20, 60); tune them on the training seasons only.

**Backtest realism**
- [ ] `Avg*` odds are an average across books, not a price you could actually bet. Use one bookmaker's odds (e.g. Bet365) for an honest backtest.
- [ ] Several outcomes of the same match can be bet at once; consider at most one bet per match.
- [ ] Add a bootstrap confidence interval on ROI, and max drawdown.

**Notebook tidy-up**
- [ ] The dumb-baseline cell still uses one-season frequencies (0.489 / 0.245 / 0.266). Use the training seasons' frequencies instead; whole-season numbers also slightly "peek" at the test data.
- [ ] Out-of-date comments: "380 matches x 9 columns", "covering one season", "rows 0..379".
- [ ] Unused imports in cell 0: `train_test_split`, `accuracy_score`, `confusion_matrix`, `classification_report`.
- [ ] Cell 0 prints a harmless pandas `PerformanceWarning` when adding the `season` column.
- [ ] Record the results in `docs/experiments.md` (scoreboard) and the main choices in `docs/decisions.md`.

## Decisions made (and why)

| Decision | Why |
|---|---|
| Average odds, not Pinnacle | Pinnacle has gaps (191/380 missing in 2025/26); average odds are complete |
| 5 seasons, not 1 | More training data, and Elo is warmed up before the test seasons |
| Drop 2021/22 from training | Elo starts every team at 1500, so that season's ratings are meaningless |
| Split by season, not randomly | A random split lets the model learn from the future (leakage) |
| Log loss as the main metric | It scores probabilities, which is what value betting needs; accuracy doesn't |
| Logistic regression over gradient boosting | Boosting overfit (train 0.43 vs test 1.24); LR's train and test scores match |
