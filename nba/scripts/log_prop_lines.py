"""Log NBA player-points prop lines from OddsPapi (Phase 10: our own line history).

Run once a day. For every NBA game that finished in the last few days and isn't logged
yet, it pulls the game's full pre-game price history (open -> close) from the free
/historical-odds endpoint and appends one row per price snapshot to
nba/data/processed/prop_lines.parquet. Raw responses are kept in
nba/data/raw/oddspapi/history/ so nothing has to be fetched twice.

Request budget (free plan = 250/month): /historical-odds is free. Only the fixture list
and the player-name list cost 1 request each, and both are cached for a week.

Usage:
    .venv/Scripts/python.exe nba/scripts/log_prop_lines.py            # log finished games
    .venv/Scripts/python.exe nba/scripts/log_prop_lines.py --dry-run  # show what it would fetch
"""

import argparse
import json
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd

from fbml.config import ROOT

BASE_URL = "https://api.oddspapi.io/v4"
NBA_TOURNAMENT_ID = 132
BASKETBALL_SPORT_ID = 11
BOOKMAKERS = "pinnacle,draftkings,fanduel"  # max 3 per historical call: one sharp + two big US books

RAW_DIR = ROOT / "nba" / "data" / "raw" / "oddspapi"
HISTORY_DIR = RAW_DIR / "history"
OUT_PATH = ROOT / "nba" / "data" / "processed" / "prop_lines.parquet"

CACHE_DAYS = 7          # refresh fixture and player lists after this many days
LOOKBACK_DAYS = 4       # log games that started within this many days
GAME_LENGTH_HOURS = 3   # treat a game as finished this long after tip-off
HISTORY_COOLDOWN_S = 5.5  # /historical-odds allows one call per 5 s


def api_get(path, **params):
    params["apiKey"] = os.environ["ODDSPAPI_KEY"]
    for attempt in range(3):
        r = httpx.get(f"{BASE_URL}/{path}", params=params, timeout=180)
        if r.status_code == 429:
            time.sleep(5 * (attempt + 1))
            continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"rate limited on /{path}")


def cached(path, max_age_days, fetch):
    """Return JSON from `path` if fresh, otherwise call `fetch()` (1 request) and save it."""
    if path.exists():
        age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
        if age < timedelta(days=max_age_days):
            return json.loads(path.read_text(encoding="utf-8"))
    data = fetch()
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def load_fixtures(now):
    def fetch():
        print("fetching fixture list (1 request)")
        frm = (now - timedelta(days=LOOKBACK_DAYS + 1)).strftime("%Y-%m-%d")
        to = (now + timedelta(days=CACHE_DAYS + 1)).strftime("%Y-%m-%d")
        return api_get("fixtures", tournamentId=NBA_TOURNAMENT_ID, **{"from": frm, "to": to}) or []

    fixtures = cached(RAW_DIR / "fixtures_cache.json", CACHE_DAYS, fetch)
    # the cached list must still cover the lookback window; refetch if it doesn't
    starts = [f["startTime"] for f in fixtures]
    if not starts or max(starts) < now.isoformat():
        (RAW_DIR / "fixtures_cache.json").unlink(missing_ok=True)
        fixtures = cached(RAW_DIR / "fixtures_cache.json", CACHE_DAYS, fetch)
    return fixtures


def load_player_names(force=False):
    path = RAW_DIR / "players_basketball.json"
    # forced refresh at most once a day, so one unknown player can't drain the quota
    if force and path.exists() and datetime.now() - datetime.fromtimestamp(path.stat().st_mtime) > timedelta(days=1):
        path.unlink()

    def fetch():
        print("fetching player list (1 request)")
        return api_get("players", sportId=BASKETBALL_SPORT_ID)

    data = cached(path, CACHE_DAYS, fetch)
    return {str(p["playerId"]): p["playerName"] for team in data["participants"].values() for p in team["players"]}


def load_points_markets():
    """marketId -> line, and outcomeId -> 'over'/'under', for full-game player points."""
    def fetch():
        print("fetching market catalog (1 request)")
        return api_get("markets", sportId=BASKETBALL_SPORT_ID)

    catalog = cached(RAW_DIR / "markets_basketball.json", 365, fetch)
    lines, sides = {}, {}
    for m in catalog:
        if m.get("marketType") == "playertotals-points" and m.get("period") == "result":
            lines[str(m["marketId"])] = m["handicap"]
            for o in m["outcomes"]:
                sides[str(o["outcomeId"])] = o["outcomeName"].lower()
    return lines, sides


def parse_history(fixture, history, lines, sides, names):
    rows = []
    for book, book_data in history.get("bookmakers", {}).items():
        for market_id, market in book_data.get("markets", {}).items():
            if market_id not in lines:
                continue
            for outcome_id, outcome in market["outcomes"].items():
                for player_id, snapshots in outcome["players"].items():
                    for s in snapshots:
                        rows.append({
                            "fixture_id": fixture["fixtureId"],
                            "start_time": fixture["startTime"],
                            "team1": fixture["participant1Name"],
                            "team2": fixture["participant2Name"],
                            "book": book,
                            "player_id": player_id,
                            "player_name": names.get(player_id),
                            "line": lines[market_id],
                            "side": sides.get(outcome_id),
                            "price": s["price"],
                            "active": s["active"],
                            "created_at": s["createdAt"],
                        })
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="list games to fetch, call nothing")
    args = parser.parse_args()

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    fixtures = load_fixtures(now)

    done_before = now - timedelta(hours=GAME_LENGTH_HOURS)
    window_start = now - timedelta(days=LOOKBACK_DAYS)
    to_fetch = [
        f for f in fixtures
        if window_start.isoformat() <= f["startTime"] <= done_before.isoformat()
        and not (HISTORY_DIR / f"{f['fixtureId']}.json").exists()
    ]
    print(f"{len(fixtures)} fixtures cached, {len(to_fetch)} finished games to log")
    if args.dry_run:
        for f in to_fetch:
            print(" ", f["startTime"], f["participant1Name"], "vs", f["participant2Name"])
        return

    lines, sides = load_points_markets()
    names = load_player_names()
    new_rows = []
    for i, f in enumerate(to_fetch):
        if i:
            time.sleep(HISTORY_COOLDOWN_S)
        history = api_get("historical-odds", fixtureId=f["fixtureId"], bookmakers=BOOKMAKERS)
        if history is None:
            print("  no history:", f["participant1Name"], "vs", f["participant2Name"])
            continue
        (HISTORY_DIR / f"{f['fixtureId']}.json").write_text(json.dumps(history), encoding="utf-8")
        rows = parse_history(f, history, lines, sides, names)
        print(f"  {f['participant1Name']} vs {f['participant2Name']}: {len(rows)} snapshots")
        new_rows += rows

    if not new_rows:
        return
    new = pd.DataFrame(new_rows)

    # names missing from the cached list: refresh it once (1 request) and fill them in
    if new["player_name"].isna().any():
        names = load_player_names(force=True)
        new["player_name"] = new["player_id"].map(names)

    if OUT_PATH.exists():
        new = pd.concat([pd.read_parquet(OUT_PATH), new], ignore_index=True).drop_duplicates()
    new.to_parquet(OUT_PATH, index=False)
    print(f"saved {len(new)} rows -> {OUT_PATH}")


if __name__ == "__main__":
    main()
