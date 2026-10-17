"""Download raw NBA regular-season game logs from stats.nba.com via nba_api.

Saves one CSV per season and log type to nba/data/raw/:
    player_gamelogs_<season>.csv   one row per player per game played
    team_gamelogs_<season>.csv     one row per team per game

Raw files are never edited; cleaning happens in notebooks/01_data.ipynb.

Usage:
    uv run python nba/scripts/download_game_logs.py            # all seasons, skip existing
    uv run python nba/scripts/download_game_logs.py --force    # re-download everything
"""

import argparse
import time
from pathlib import Path

from nba_api.stats.endpoints import leaguegamelog

SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
LOG_TYPES = {"player": "P", "team": "T"}
RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"

PAUSE_SECONDS = 2  # stats.nba.com throttles fast clients
RETRIES = 3


def fetch(season: str, player_or_team: str):
    for attempt in range(1, RETRIES + 1):
        try:
            log = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
                player_or_team_abbreviation=player_or_team,
                timeout=60,
            )
            return log.get_data_frames()[0]
        except Exception as exc:  # network errors and timeouts are common
            print(f"  attempt {attempt} failed: {exc}")
            time.sleep(PAUSE_SECONDS * attempt * 2)
    raise RuntimeError(f"giving up on {season} {player_or_team}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="re-download existing files")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for season in SEASONS:
        for name, code in LOG_TYPES.items():
            out = RAW_DIR / f"{name}_gamelogs_{season}.csv"
            if out.exists() and not args.force:
                print(f"skip {out.name} (exists)")
                continue
            print(f"fetching {name} logs {season} ...")
            df = fetch(season, code)
            df.to_csv(out, index=False)
            print(f"  saved {out.name}: {len(df):,} rows")
            time.sleep(PAUSE_SECONDS)


if __name__ == "__main__":
    main()
