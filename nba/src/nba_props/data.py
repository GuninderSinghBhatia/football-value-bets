"""Raw game logs -> clean tables (the 01_data notebook as functions), plus current-season downloads."""

import time

import pandas as pd

from .config import CURRENT_SEASON_LABEL, RAW_DIR

GAME_COLS = ["season", "player_id", "player", "team", "opponent", "game_id",
             "date", "home", "minutes", "points", "fga", "fg3a", "fta"]


def clean_player_logs(players: pd.DataFrame) -> pd.DataFrame:
    """Raw LeagueGameLog player rows -> one row per player per game played (01_data Steps 2-4)."""
    players = players.copy()
    players["date"] = pd.to_datetime(players["GAME_DATE"])
    players["home"] = (~players["MATCHUP"].str.contains("@")).astype(int)
    players["opponent"] = players["MATCHUP"].str.split(" ").str[-1]
    players = players[players["MIN"] > 0]
    players = players.rename(columns={
        "SEASON_ID": "season", "PLAYER_ID": "player_id", "PLAYER_NAME": "player", "GAME_ID": "game_id",
        "MIN": "minutes", "TEAM_ABBREVIATION": "team", "PTS": "points", "FGA": "fga", "FG3A": "fg3a",
        "FTA": "fta",
    })
    players = players.sort_values(["date", "player_id"]).reset_index(drop=True)
    return players[GAME_COLS]


def load_games() -> pd.DataFrame:
    """Every downloaded season (history + the current one, if any games exist yet)."""
    files = sorted(RAW_DIR.glob("player_gamelogs_*.csv"))
    raw = pd.concat([pd.read_csv(f, dtype={"GAME_ID": str}) for f in files], ignore_index=True)
    return clean_player_logs(raw)


def load_team_logs() -> pd.DataFrame:
    files = sorted(RAW_DIR.glob("team_gamelogs_*.csv"))
    return pd.concat([pd.read_csv(f, dtype={"GAME_ID": str}) for f in files], ignore_index=True)


def download_current_season(retries: int = 3) -> dict:
    """Refresh this season's player and team logs from stats.nba.com. Returns rows saved per file."""
    from nba_api.stats.endpoints import leaguegamelog

    saved = {}
    for name, code in {"player": "P", "team": "T"}.items():
        for attempt in range(1, retries + 1):
            try:
                df = leaguegamelog.LeagueGameLog(
                    season=CURRENT_SEASON_LABEL, season_type_all_star="Regular Season",
                    player_or_team_abbreviation=code, timeout=60,
                ).get_data_frames()[0]
                break
            except Exception as exc:  # stats.nba.com times out often
                print(f"  {name} logs attempt {attempt} failed: {exc}")
                time.sleep(4 * attempt)
        else:
            raise RuntimeError(f"could not download {name} logs for {CURRENT_SEASON_LABEL}")
        out = RAW_DIR / f"{name}_gamelogs_{CURRENT_SEASON_LABEL}.csv"
        if len(df):  # an empty file would break the dtype of the concatenated table
            df.to_csv(out, index=False)
        saved[out.name] = len(df)
        time.sleep(2)
    return saved


def current_rosters() -> pd.DataFrame:
    """nba_api PlayerIndex: every rostered player this season with his current team (1 call)."""
    from nba_api.stats.endpoints import playerindex

    df = playerindex.PlayerIndex(season=CURRENT_SEASON_LABEL, timeout=60).get_data_frames()[0]
    df = df[df["TEAM_ABBREVIATION"].notna() & (df["TEAM_ABBREVIATION"] != "")]
    return pd.DataFrame({
        "player_id": df["PERSON_ID"].astype(int),
        "player": (df["PLAYER_FIRST_NAME"] + " " + df["PLAYER_LAST_NAME"]).str.strip(),
        "team": df["TEAM_ABBREVIATION"],
    })
