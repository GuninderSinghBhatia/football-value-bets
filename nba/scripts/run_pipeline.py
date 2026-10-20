"""Run one paper-trading cycle: refresh logs, settle finished games, fetch tonight's DraftKings
points lines (ESPN), predict, place paper bets, update closing lines, export JSON for the web app.

Safe to run as often as you like (every 30 min on game days gives good closing lines).
Paper trading only: nothing here places a real bet.

Usage:
    .venv/Scripts/python.exe nba/scripts/run_pipeline.py
    .venv/Scripts/python.exe nba/scripts/run_pipeline.py --no-refresh   # skip the nba_api download
"""

import argparse

from nba_props.live import run

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-refresh", action="store_true", help="use the cached game logs")
    run(refresh=not parser.parse_args().no_refresh)
