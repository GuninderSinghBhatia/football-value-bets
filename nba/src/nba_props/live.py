"""Nightly paper-trading cycle (roadmap Part B jobs): fetch lines -> predict -> paper bet ->
closing snapshot -> settle -> export JSON for the web app.

Tables (parquet, nba/data/live/):
    prop_snapshots   every line seen, every run (the raw history)
    predictions      one row per player-game: first look + latest pre-game look + result (Phase 8)
    paper_bets       one row per bet: at most one per player per game (Phase 9 / Gate 3)
"""

import json
from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd

from . import espn
from .config import CURRENT_SEASON, EV_THRESHOLD, LIVE_DIR, MODEL_VERSION, RAW_DIR, STAKE, WEB_EXPORT_DIR
from .data import current_rosters, download_current_season, load_games, load_team_logs
from .evaluate import bet_summary, by_period, clv_for_bet, gate2, max_drawdown
from .features import FEATURES, build_features, fill_season_start
from .odds import american_to_decimal, no_vig_over
from .predict import LIVE_FEATURES_PATH, decide, load_model

SNAPSHOTS = LIVE_DIR / "prop_snapshots.parquet"
PREDICTIONS = LIVE_DIR / "predictions.parquet"
BETS = LIVE_DIR / "paper_bets.parquet"

ROTATION_SIZE = 10        # a team uses ~10 players a night (median in 2021-26 logs)
LOOKAHEAD_HOURS = 36      # predict games that start within this window
LOGS_MAX_AGE_HOURS = 6    # re-download this season's logs when older than this
VOID_AFTER_DAYS = 3       # a game with no box score after this long is void (postponed)

KEY_FEATURES = ["points_last10", "points_season_avg", "minutes_last10", "usage_last10",
                "missing_pts", "opp_def_rating_last10", "rest_days"]


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _read(path, columns=None) -> pd.DataFrame:
    return pd.read_parquet(path) if path.exists() else pd.DataFrame(columns=columns or [])


def _game_date(start_time: str) -> pd.Timestamp:
    # US calendar date of the game (nba_api dates are local). -6h maps every tip-off (12:00-02:30 UTC
    # for late West Coast games) to its US date.
    return (pd.Timestamp(start_time).tz_convert(None) - pd.Timedelta(hours=6)).normalize()


# ---------------------------------------------------------------- step 0: data refresh

def refresh_logs(force: bool = False) -> None:
    stamp = RAW_DIR / ".current_season_refreshed"
    if not force and stamp.exists():
        age = datetime.now() - datetime.fromtimestamp(stamp.stat().st_mtime)
        if age < timedelta(hours=LOGS_MAX_AGE_HOURS):
            return
    print("refreshing this season's game logs:", download_current_season())
    stamp.touch()


def slate(now: datetime) -> list[dict]:
    """Every game on yesterday's, today's and tomorrow's ESPN dates."""
    events = {}
    for d in (now - timedelta(days=1), now, now + timedelta(days=1)):
        for e in espn.scoreboard(d.strftime("%Y%m%d")):
            events[e["event_id"]] = e
    return sorted(events.values(), key=lambda e: e["start_time"])


# ---------------------------------------------------------------- step 1-2: lines + features

def _match_players(espn_names: dict[str, str], nba_players: pd.DataFrame) -> dict[str, int]:
    """ESPN athlete id -> nba_api player id, by normalised name (team first, then league-wide)."""
    by_name = {}
    for row in nba_players.itertuples():
        by_name.setdefault(espn.norm_name(row.player), set()).add(row.player_id)
    out = {}
    for aid, name in espn_names.items():
        ids = by_name.get(espn.norm_name(name), set())
        if len(ids) == 1:
            out[aid] = next(iter(ids))
    return out


def tonight_rows(games_today: list[dict], history: pd.DataFrame, rosters: pd.DataFrame,
                 out_names: set[str], prop_players: dict[str, set[int]]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Player rows (expected to play) and team rows for tonight's games, stats left NaN."""
    recent = (history.sort_values("date").groupby("player_id").tail(10)
              .groupby("player_id")["minutes"].mean())
    players, teams = [], []
    for g in games_today:
        date = _game_date(g["start_time"])
        for side, opp, home in (("home", "away", 1), ("away", "home", 0)):
            team, opponent = g[side], g[opp]
            squad = rosters[rosters["team"] == team].copy()
            squad = squad[~squad["player"].map(espn.norm_name).isin(out_names)]
            squad["recent_min"] = squad["player_id"].map(recent)
            rotation = set(squad.dropna(subset=["recent_min"]).nlargest(ROTATION_SIZE, "recent_min")["player_id"])
            ids = rotation | prop_players.get(team, set())
            names = dict(zip(rosters["player_id"], rosters["player"], strict=False))
            names |= dict(zip(history["player_id"], history["player"], strict=False))
            for pid in ids:
                players.append({"season": CURRENT_SEASON, "player_id": pid, "player": names.get(pid, str(pid)),
                                "team": team, "opponent": opponent, "game_id": g["event_id"], "date": date,
                                "home": home})
            teams.append({"TEAM_ABBREVIATION": team, "GAME_ID": g["event_id"], "GAME_DATE": date})
    return pd.DataFrame(players), pd.DataFrame(teams)


def build_live_features(games_today, history, teams_raw, rosters, out_names, prop_players) -> pd.DataFrame:
    rows, team_rows = tonight_rows(games_today, history, rosters, out_names, prop_players)
    if rows.empty:
        return rows
    allg = pd.concat([history, rows], ignore_index=True)
    allt = pd.concat([teams_raw, team_rows], ignore_index=True)
    feats = build_features(allg, allt)
    tonight = feats[feats["game_id"].isin(rows["game_id"].unique())]
    tonight = fill_season_start(tonight, history, CURRENT_SEASON)
    tonight.to_parquet(LIVE_FEATURES_PATH, index=False)
    return tonight


# ---------------------------------------------------------------- step 3: predict + paper bet

def predict_slate(events: list[dict], now: datetime, history: pd.DataFrame, teams_raw: pd.DataFrame) -> int:
    soon = [e for e in events if e["state"] == "pre"
            and pd.Timestamp(e["start_time"]) <= pd.Timestamp(now) + pd.Timedelta(hours=LOOKAHEAD_HOURS)]
    # one upcoming game per team, or the second one's rolling windows would include the first
    seen, games_today = set(), []
    for e in soon:
        if e["home"] in seen or e["away"] in seen:
            continue
        seen |= {e["home"], e["away"]}
        games_today.append(e)
    if not games_today:
        print("no upcoming games in the next", LOOKAHEAD_HOURS, "hours")
        return 0

    rosters = current_rosters()
    known = pd.concat([rosters[["player_id", "player"]],
                       history[["player_id", "player"]].drop_duplicates("player_id")]).drop_duplicates("player_id")
    report = espn.injuries()
    out_names = {espn.norm_name(i["player"]) for i in report if i["status"] == "Out" and i["player"]}
    status_by_name = {espn.norm_name(i["player"]): i["status"] for i in report if i["player"]}

    lines, prop_players = [], {}
    for g in games_today:
        props = espn.points_props(g["event_id"])
        names_by_team = {g["home"]: espn.roster(g["home_espn_id"]), g["away"]: espn.roster(g["away_espn_id"])}
        for team, names in names_by_team.items():
            team_known = known[known["player_id"].isin(rosters.loc[rosters["team"] == team, "player_id"])]
            ids = _match_players(names, team_known)
            ids |= {a: p for a, p in _match_players(names, known).items() if a not in ids}
            for p in props:
                if p["espn_athlete_id"] in names:
                    pid = ids.get(p["espn_athlete_id"])
                    lines.append({**p, "event_id": g["event_id"], "start_time": g["start_time"],
                                  "team": team, "opponent": g["away"] if team == g["home"] else g["home"],
                                  "player": names[p["espn_athlete_id"]], "player_id": pid})
                    if pid is not None:
                        prop_players.setdefault(team, set()).add(pid)
        print(f"  {g['away']} @ {g['home']}: {len(props)} points lines")

    tonight = build_live_features(games_today, history, teams_raw, rosters, out_names, prop_players)
    if not lines:
        return 0
    model = load_model()
    feats = tonight.set_index(["player_id", "game_id"]) if len(tonight) else pd.DataFrame()
    taken_at = _iso(now)
    snaps, preds = [], []
    for ln in lines:
        snaps.append({**ln, "taken_at": taken_at})
        rec = {k: ln[k] for k in ("event_id", "start_time", "espn_athlete_id", "player_id", "player",
                                   "team", "opponent", "line", "over_odds", "under_odds", "open_line",
                                   "open_over_odds", "open_under_odds", "book")}
        rec |= {"taken_at": taken_at, "injury_status": status_by_name.get(espn.norm_name(ln["player"]))}
        key = (ln["player_id"], ln["event_id"])
        if ln["player_id"] is None or key not in feats.index:
            rec["skip_reason"] = "no nba_api match" if ln["player_id"] is None else "not in tonight's rows"
        elif ln["over_odds"] is None or ln["under_odds"] is None:
            rec["skip_reason"] = "missing price"
        else:
            row = feats.loc[key]
            if not np.isfinite(row[FEATURES].astype(float)).all():
                rec["skip_reason"] = "fewer than 10 earlier games"
            else:
                rec |= decide(model, row, ln["line"], ln["over_odds"], ln["under_odds"])
                rec |= {"season_avg_filled": bool(row.get("season_avg_filled", False)),
                        **{f"f_{k}": float(row[k]) for k in KEY_FEATURES}}
        preds.append(rec)

    snaps = pd.DataFrame(snaps)
    old = _read(SNAPSHOTS)
    pd.concat([old, snaps], ignore_index=True).to_parquet(SNAPSHOTS, index=False)
    _update_predictions(pd.DataFrame(preds))
    placed = _place_bets(pd.DataFrame(preds), now)
    print(f"{len(preds)} props, {sum('predicted_points' in p for p in preds)} predicted, {placed} new paper bets")
    return placed


def _update_predictions(latest: pd.DataFrame) -> None:
    """Keep the first look (first_*) and overwrite the latest pre-game look (no prefix)."""
    table = _read(PREDICTIONS)
    if "predicted_points" not in latest:
        latest["predicted_points"] = np.nan
    latest["key"] = latest["event_id"] + ":" + latest["espn_athlete_id"]
    if len(table):
        first_cols = [c for c in table.columns if c.startswith("first_")]
        firsts = table.set_index("key")[first_cols]
        results = table.set_index("key")[[c for c in ("actual_points", "played", "minutes_played", "settled_at")
                                          if c in table.columns]]
        latest = latest.set_index("key")
        latest = latest.join(firsts, how="left").join(results, how="left").reset_index()
        keep = table[~table["key"].isin(latest["key"])]
    else:
        keep = table
    for c in ("taken_at", "line", "over_odds", "under_odds", "predicted_points", "p_over", "pick"):
        fc = f"first_{c}"
        if fc not in latest:
            latest[fc] = latest.get(c)
        latest[fc] = latest[fc].where(latest[fc].notna(), latest.get(c))
    pd.concat([keep, latest], ignore_index=True).to_parquet(PREDICTIONS, index=False)


def _place_bets(preds: pd.DataFrame, now: datetime) -> int:
    bets = _read(BETS)
    if "pick" not in preds:
        return 0
    picks = preds[preds["pick"].isin(["over", "under"])]
    have = set(bets["key"]) if len(bets) else set()
    new = []
    for p in picks.itertuples():
        key = f"{p.event_id}:{p.espn_athlete_id}"
        if key in have:
            continue
        odds = p.over_odds if p.pick == "over" else p.under_odds
        new.append({
            "key": key, "bet_id": f"nba-{p.event_id}-{p.espn_athlete_id}", "placed_at": _iso(now),
            "event_id": p.event_id, "start_time": p.start_time, "player_id": p.player_id, "player": p.player,
            "espn_athlete_id": p.espn_athlete_id, "team": p.team, "opponent": p.opponent, "side": p.pick,
            "line": p.line, "odds": odds, "decimal": float(american_to_decimal(odds)),
            "p_side": p.p_over if p.pick == "over" else p.p_under,
            "ev": p.ev_over if p.pick == "over" else p.ev_under,
            "predicted_points": p.predicted_points, "book": p.book, "stake": STAKE,
            "season_start": bool(p.season_avg_filled),  # first game of the season: last season's average
            "status": "open", "model_version": MODEL_VERSION,
            "close_line": np.nan, "close_over_odds": np.nan, "close_under_odds": np.nan, "close_at": None,
            "close_pred": np.nan, "actual_points": np.nan, "profit": np.nan, "clv": np.nan, "settled_at": None,
        })
    if new:
        pd.concat([bets, pd.DataFrame(new)], ignore_index=True).to_parquet(BETS, index=False)
    return len(new)


# ---------------------------------------------------------------- step 4: closing snapshot

def snapshot_closing(events: list[dict]) -> None:
    """The latest pre-game line for each open bet is its closing line (runs every cycle)."""
    bets, preds = _read(BETS), _read(PREDICTIONS)
    if bets.empty or preds.empty:
        return
    pre = {e["event_id"] for e in events if e["state"] == "pre"}
    latest = preds.set_index("key")
    for i, b in bets.iterrows():
        if b["status"] != "open" or b["event_id"] not in pre or b["key"] not in latest.index:
            continue
        p = latest.loc[b["key"]]
        bets.loc[i, ["close_line", "close_over_odds", "close_under_odds", "close_at", "close_pred"]] = \
            [p["line"], p["over_odds"], p["under_odds"], p["taken_at"], p.get("predicted_points")]
    bets.to_parquet(BETS, index=False)


# ---------------------------------------------------------------- step 5: settle

def settle(now: datetime) -> int:
    preds, bets = _read(PREDICTIONS), _read(BETS)
    if preds.empty:
        return 0
    if "actual_points" not in preds:
        preds["actual_points"], preds["played"], preds["minutes_played"], preds["settled_at"] = \
            np.nan, None, np.nan, None
    unsettled = preds[preds["settled_at"].isna()]
    started = pd.to_datetime(unsettled["start_time"], utc=True) < pd.Timestamp(now) - pd.Timedelta(hours=3)
    model = load_model()
    n = 0
    for event_id in unsettled.loc[started, "event_id"].unique():
        box = espn.box_score(event_id)
        start = pd.Timestamp(unsettled.loc[unsettled["event_id"] == event_id, "start_time"].iloc[0])
        stale = pd.Timestamp(now) - start > pd.Timedelta(days=VOID_AFTER_DAYS)
        if not box and not stale:
            continue  # not final yet
        m = (preds["event_id"] == event_id) & preds["settled_at"].isna()
        for i in preds.index[m]:
            r = box.get(preds.at[i, "espn_athlete_id"])
            preds.at[i, "played"] = bool(r and r["played"])
            preds.at[i, "actual_points"] = r["points"] if r and r["played"] else np.nan
            preds.at[i, "minutes_played"] = r["minutes"] if r else np.nan
            preds.at[i, "settled_at"] = _iso(now)
        if len(bets):
            for i in bets.index[(bets["event_id"] == event_id) & (bets["status"] == "open")]:
                b = bets.loc[i]
                r = box.get(b["espn_athlete_id"])
                if not r or not r["played"]:
                    bets.loc[i, ["status", "profit"]] = ["void", 0.0]  # books void props for DNPs
                    continue
                won = r["points"] > b["line"] if b["side"] == "over" else r["points"] < b["line"]
                push = r["points"] == b["line"]
                bets.loc[i, "actual_points"] = r["points"]
                bets.loc[i, "status"] = "void" if push else ("won" if won else "lost")
                bets.loc[i, "profit"] = 0.0 if push else (b["stake"] * (b["decimal"] - 1) if won else -b["stake"])
                if pd.notna(b.get("close_line")) and pd.notna(b.get("close_over_odds")):
                    pred = b.get("close_pred") if pd.notna(b.get("close_pred")) else b["predicted_points"]
                    bets.loc[i, "clv"] = clv_for_bet(b["side"], b["line"], b["decimal"], b["close_line"],
                                                     b["close_over_odds"], b["close_under_odds"],
                                                     lambda line, pr=pred: model.p_over(pr, line)[0])
                bets.loc[i, "settled_at"] = _iso(now)
                n += 1
    preds.to_parquet(PREDICTIONS, index=False)
    if len(bets):
        bets.to_parquet(BETS, index=False)
    return n


# ---------------------------------------------------------------- step 6: export for the web app

def _clean(v):
    if isinstance(v, (np.floating, float)):
        return None if not np.isfinite(v) else round(float(v), 4)
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.bool_):
        return bool(v)
    if v is pd.NaT or (not isinstance(v, (str, list, dict, bool)) and pd.isna(v)):
        return None
    return v


def _records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in r.items()} for r in df.to_dict("records")]


def export(events: list[dict], history: pd.DataFrame, now: datetime) -> None:
    preds, bets = _read(PREDICTIONS), _read(BETS)
    last10 = (history.sort_values("date").groupby("player_id").tail(10)
              .assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d")))
    last10_by_player = {pid: _records(g[["date", "opponent", "home", "minutes", "points"]])
                        for pid, g in last10.groupby("player_id")}

    games = []
    for e in events:
        rows = preds[preds["event_id"] == e["event_id"]] if len(preds) else preds
        props = []
        for r in _records(rows.sort_values("line", ascending=False)) if len(rows) else []:
            r["last10"] = last10_by_player.get(r["player_id"], []) if r.get("player_id") is not None else []
            r["no_vig_p_over"] = _clean(no_vig_over(american_to_decimal(r["over_odds"]),
                                                    american_to_decimal(r["under_odds"]))) \
                if r.get("over_odds") is not None and r.get("under_odds") is not None else None
            props.append(r)
        games.append({**{k: e[k] for k in ("event_id", "start_time", "state", "status", "home", "away",
                                            "home_name", "away_name", "home_score", "away_score")},
                      "props": props})

    settled = bets[bets["status"].isin(["won", "lost"])].sort_values("start_time") if len(bets) else bets
    curve = []
    if len(settled):
        day = pd.to_datetime(settled["start_time"], utc=True).dt.strftime("%Y-%m-%d")
        daily = settled.groupby(day)["profit"].sum().cumsum()
        curve = [{"date": d, "profit": round(float(p), 3)} for d, p in daily.items()]
    g2 = gate2(preds[preds.get("played", pd.Series(dtype=bool)) == True]) if "played" in preds else {"n": 0}  # noqa: E712
    performance = {
        "generated_at": _iso(now), "model_version": MODEL_VERSION, "ev_threshold": EV_THRESHOLD,
        "summary": {k: _clean(v) if not isinstance(v, list) else [_clean(x) for x in v]
                    for k, v in (bet_summary(bets) if len(bets) else bet_summary(
                        pd.DataFrame(columns=["status", "profit", "clv", "ev", "start_time"]))).items()},
        "curve": curve,
        "by_month": _records(by_period(bets)) if len(bets) else [],
        "gate2": {k: _clean(v) for k, v in g2.items()},
        "max_drawdown": max_drawdown(settled["profit"]) if len(settled) else 0.0,
    }
    tonight = {"generated_at": _iso(now), "model_version": MODEL_VERSION, "ev_threshold": EV_THRESHOLD,
               "games": games}
    for name, data in (("tonight.json", tonight), ("bets.json", _records(bets) if len(bets) else []),
                       ("performance.json", performance)):
        (WEB_EXPORT_DIR / name).write_text(json.dumps(data, indent=1), encoding="utf-8")
    print("exported ->", WEB_EXPORT_DIR)


# ---------------------------------------------------------------- the full cycle

def run(refresh: bool = True) -> None:
    now = _now()
    if refresh:
        try:
            refresh_logs()
        except Exception as exc:  # stats.nba.com is flaky; yesterday's logs are good enough for one run
            print("log refresh failed, using cached logs:", exc)
    history = load_games()
    teams_raw = load_team_logs()
    events = slate(now)
    print(f"{len(events)} games on the slate")
    settled = settle(now)
    print(f"settled {settled} bets")
    predict_slate(events, now, history, teams_raw)
    snapshot_closing(events)
    export(events, history, now)
