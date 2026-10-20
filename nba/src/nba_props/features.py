"""Feature building (the 03_features notebook as one function).

Every feature uses only games before the current one: groupby -> shift(1) -> rolling.
The same function serves training and live use. For live use, append "tonight" rows with the
stats (points, minutes, ...) left as NaN; shift(1) keeps them out of every window, so their
features are computed from history only.
"""

import numpy as np
import pandas as pd

FORM_STATS = ["points", "minutes", "fga", "fg3a", "fta"]
WINDOWS = [5, 10]
FEATURES = (
    [f"{s}_last{w}" for s in FORM_STATS for w in WINDOWS]
    + ["points_season_avg", "pts_per_min_last10", "minutes_trend", "usage_last10",
       "home", "rest_days", "back_to_back", "long_rest",
       "team_pts_last10", "missing_pts",
       "opp_def_rating_last10", "opp_pace_last10"]
)
ID_COLS = ["season", "player_id", "player", "team", "opponent", "game_id", "date"]
TARGET = "points"


def _rolling(df: pd.DataFrame, by, col: str, window: int | None) -> pd.Series:
    roll = (lambda s: s.shift(1).expanding().mean()) if window is None else \
           (lambda s: s.shift(1).rolling(window).mean())
    return df.groupby(by)[col].transform(roll)


def team_table(teams_raw: pd.DataFrame) -> pd.DataFrame:
    """Team box scores -> per-game defensive rating and pace, with rolling last-10 versions."""
    teams = teams_raw.rename(columns={
        "TEAM_ABBREVIATION": "team", "GAME_ID": "game_id", "GAME_DATE": "date", "MIN": "team_min",
        "FGA": "t_fga", "FTA": "t_fta", "OREB": "t_oreb", "TOV": "t_tov", "PTS": "t_pts"})
    teams = teams[["team", "game_id", "date", "team_min", "t_fga", "t_fta", "t_oreb", "t_tov", "t_pts"]].copy()
    teams["date"] = pd.to_datetime(teams["date"])
    teams["poss"] = teams["t_fga"] + 0.44 * teams["t_fta"] - teams["t_oreb"] + teams["t_tov"]

    # the opponent's row in the same game: their points = points this team allowed
    opp = teams[["game_id", "team", "t_pts", "poss"]].rename(
        columns={"team": "opp_team", "t_pts": "pts_allowed", "poss": "opp_poss"})
    teams = teams.merge(opp, on="game_id")
    teams = teams[teams["team"] != teams["opp_team"]]

    game_poss = (teams["poss"] + teams["opp_poss"]) / 2
    teams["def_rating"] = 100 * teams["pts_allowed"] / game_poss
    teams["pace"] = game_poss * 240 / teams["team_min"]

    teams = teams.sort_values(["team", "date"])
    for col in ["def_rating", "pace"]:
        teams[f"{col}_last10"] = _rolling(teams, "team", col, 10)
    return teams


def build_features(games: pd.DataFrame, teams_raw: pd.DataFrame) -> pd.DataFrame:
    """Clean player-game table + raw team logs -> ID columns, 22 features, target and minutes."""
    games = games.sort_values(["player_id", "date"]).reset_index(drop=True)

    # player form
    for stat in FORM_STATS:
        for w in WINDOWS:
            games[f"{stat}_last{w}"] = _rolling(games, "player_id", stat, w)
    games["points_season_avg"] = _rolling(games, ["player_id", "season"], "points", None)
    games["pts_per_min_last10"] = games["points_last10"] / games["minutes_last10"]

    # schedule
    games["rest_days"] = games.groupby("player_id")["date"].diff().dt.days
    first_of_season = games.groupby(["player_id", "season"]).cumcount() == 0
    games["back_to_back"] = (games["rest_days"] == 1).astype(int)
    games["long_rest"] = ((games["rest_days"] >= 4) & ~first_of_season).astype(int)

    # teammates: the team's usual scoring minus the usual scoring of the players who play tonight
    team_games = (
        games.groupby(["team", "game_id", "date"], as_index=False)["points"].sum(min_count=1)
        .rename(columns={"points": "team_pts"})
        .sort_values(["team", "date"])
    )
    team_games["team_pts_last10"] = _rolling(team_games, "team", "team_pts", 10)
    games = games.merge(team_games[["team", "game_id", "team_pts_last10"]], on=["team", "game_id"], how="left")
    available_pts = games.groupby(["team", "game_id"])["points_last10"].transform("sum")
    games["missing_pts"] = games["team_pts_last10"] - available_pts

    # role
    teams = team_table(teams_raw)
    games["minutes_trend"] = games["minutes_last5"] - games["minutes_last10"]
    games = games.merge(teams[["team", "game_id", "t_fga", "t_fta"]], on=["team", "game_id"], how="left")
    usage_tonight = (games["fga"] + 0.44 * games["fta"]) / (games["t_fga"] + 0.44 * games["t_fta"])
    games["usage_last10"] = usage_tonight.groupby(games["player_id"]).transform(
        lambda s: s.shift(1).rolling(10).mean())
    games = games.drop(columns=["t_fga", "t_fta"])

    # opponent
    opp_form = teams[["team", "game_id", "def_rating_last10", "pace_last10"]].rename(columns={
        "team": "opponent", "def_rating_last10": "opp_def_rating_last10", "pace_last10": "opp_pace_last10"})
    games = games.merge(opp_form, on=["opponent", "game_id"], how="left")

    out = games[ID_COLS + FEATURES + [TARGET, "minutes"]]
    return out.sort_values(["date", "player_id"]).reset_index(drop=True)


def last_season_avg(games: pd.DataFrame, season: int) -> pd.Series:
    """Each player's points per game in the season before `season` (fallback for opening games)."""
    prev = games[games["season"] == season - 1]
    return prev.groupby("player_id")["points"].mean()


TYPICAL_REST_DAYS = 2  # median rest in training


def fill_season_start(rows: pd.DataFrame, games: pd.DataFrame, season: int) -> pd.DataFrame:
    """Live only: a player's first game of a season has no season average yet, so use last season's
    (roadmap Phase 3: "fall back to last season's averages"). Training rows keep the NaN and are dropped.

    Openers were never in the training rows, so their rest_days (the ~190-day summer break) is far
    outside anything the model saw; treat it as normal rest."""
    rows = rows.copy()
    fallback = rows["player_id"].map(last_season_avg(games, season))
    rows["season_avg_filled"] = rows["points_season_avg"].isna() & fallback.notna()
    rows["points_season_avg"] = rows["points_season_avg"].fillna(fallback)
    opener = rows["season_avg_filled"] | (rows["rest_days"] > 120)
    rows.loc[opener, "rest_days"] = TYPICAL_REST_DAYS
    rows.loc[opener, "long_rest"] = 0
    return rows


def has_full_history(rows: pd.DataFrame) -> np.ndarray:
    return rows[FEATURES].notna().all(axis=1).to_numpy()
