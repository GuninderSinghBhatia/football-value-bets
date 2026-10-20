"""ESPN's free public NBA endpoints: schedule, DraftKings player-points lines, injuries, box scores.

No key and no request budget. Unofficial, so every parser is defensive.
"""

import re
import time
import unicodedata

import httpx

SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba"
DRAFTKINGS = "100"  # ESPN odds provider id

# ESPN abbreviations that differ from stats.nba.com
ESPN_TO_NBA = {"GS": "GSW", "NO": "NOP", "NY": "NYK", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS"}


def nba_abbr(espn_abbr: str) -> str:
    return ESPN_TO_NBA.get(espn_abbr, espn_abbr)


def _get(url: str, **params) -> dict:
    for attempt in range(3):
        try:
            r = httpx.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def norm_name(name: str) -> str:
    """'Luka Dončić' / 'Jaren Jackson Jr.' -> 'luka doncic' / 'jaren jackson' for cross-source matching."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    name = re.sub(r"[^a-z ]", "", name.lower().replace("-", " "))
    return " ".join(w for w in name.split() if w not in {"jr", "sr", "ii", "iii", "iv", "v"})


def scoreboard(yyyymmdd: str) -> list[dict]:
    """Games on one ESPN (US Eastern) date."""
    out = []
    for e in _get(f"{SITE}/scoreboard", dates=yyyymmdd).get("events", []):
        comp = e["competitions"][0]
        teams = {c["homeAway"]: c for c in comp["competitors"]}
        out.append({
            "event_id": e["id"],
            "start_time": e["date"],
            "state": e["status"]["type"]["state"],          # pre / in / post
            "completed": e["status"]["type"]["completed"],
            "status": e["status"]["type"]["shortDetail"],
            "home": nba_abbr(teams["home"]["team"]["abbreviation"]),
            "away": nba_abbr(teams["away"]["team"]["abbreviation"]),
            "home_espn_id": teams["home"]["team"]["id"],
            "away_espn_id": teams["away"]["team"]["id"],
            "home_name": teams["home"]["team"]["displayName"],
            "away_name": teams["away"]["team"]["displayName"],
            "home_score": int(teams["home"].get("score") or 0),
            "away_score": int(teams["away"].get("score") or 0),
        })
    return out


def roster(espn_team_id: str) -> dict[str, str]:
    """ESPN athlete id -> display name for one team."""
    data = _get(f"{SITE}/teams/{espn_team_id}/roster")
    return {a["id"]: a["displayName"] for a in data.get("athletes", [])}


def _athlete_id(ref: str) -> str | None:
    m = re.search(r"/athletes/(\d+)", ref or "")
    return m.group(1) if m else None


def points_props(event_id: str) -> list[dict]:
    """DraftKings 'Total Points' lines for one game: one dict per player with over and under prices.

    ESPN doesn't label the side. Each player has two entries at the same line; the over is the one
    whose price matches the 'N+ points' milestone at ceil(line), and ESPN lists the over first.
    """
    items, page = [], 1
    while True:
        data = _get(f"{CORE}/events/{event_id}/competitions/{event_id}/odds/{DRAFTKINGS}/propBets",
                    limit=1000, page=page)
        items += data.get("items", [])
        if page >= data.get("pageCount", 1):
            break
        page += 1

    totals, milestones = {}, {}
    for it in items:
        aid = _athlete_id(it.get("athlete", {}).get("$ref"))
        kind = it.get("type", {}).get("name")
        if not aid:
            continue
        if kind == "Total Points":
            totals.setdefault(aid, []).append(it)
        elif kind == "Points Milestones":
            milestones[(aid, float(it["current"]["target"]["value"]))] = float(it["odds"]["american"]["value"])

    out = []
    for aid, pair in totals.items():
        if len(pair) != 2:
            continue
        line = float(pair[0]["current"]["target"]["value"])
        if float(pair[1]["current"]["target"]["value"]) != line:
            continue
        a, b = (float(p["odds"]["american"]["value"]) for p in pair)
        over_i = 0
        ms = milestones.get((aid, float(int(line) + 1)))
        if ms is not None and abs(b - ms) < abs(a - ms):
            over_i = 1
        over, under = pair[over_i], pair[1 - over_i]

        def price(p, key):
            v = p["odds"]["american"].get(key)
            return float(v) if v not in (None, "") else None

        out.append({
            "espn_athlete_id": aid,
            "line": line,
            "over_odds": price(over, "value"),
            "under_odds": price(under, "value"),
            "open_line": float(over.get("open", {}).get("target", {}).get("value", line)),
            "open_over_odds": price(over, "open"),
            "open_under_odds": price(under, "open"),
            "book": "draftkings",
            "updated": over.get("lastUpdated"),
        })
    return out


def injuries() -> list[dict]:
    """League-wide injury report: name, ESPN athlete id, status ('Out', 'Day-To-Day', ...)."""
    out = []
    for team in _get(f"{SITE}/injuries").get("injuries", []):
        for inj in team.get("injuries", []):
            ath = inj.get("athlete", {})
            href = (ath.get("links") or [{}])[0].get("href", "")
            m = re.search(r"/id/(\d+)", href)
            out.append({
                "espn_athlete_id": m.group(1) if m else None,
                "player": ath.get("displayName"),
                "team_name": team.get("displayName"),
                "status": inj.get("status"),
                "detail": inj.get("shortComment"),
            })
    return out


def box_score(event_id: str) -> dict[str, dict]:
    """ESPN athlete id -> {'points', 'minutes', 'played'} for a finished game."""
    data = _get(f"{SITE}/summary", event=event_id)
    out = {}
    for team in data.get("boxscore", {}).get("players", []):
        for block in team.get("statistics", []):
            names = block.get("names") or block.get("labels") or []
            for a in block.get("athletes", []):
                aid = a["athlete"]["id"]
                stats = dict(zip(names, a.get("stats") or [], strict=False))
                minutes = stats.get("MIN")
                played = bool(stats) and not a.get("didNotPlay") and minutes not in (None, "0", "--")
                out[aid] = {
                    "name": a["athlete"]["displayName"],
                    "points": int(stats["PTS"]) if played and stats.get("PTS", "").isdigit() else 0,
                    "minutes": int(minutes) if played and str(minutes).isdigit() else 0,
                    "played": played,
                }
    return out
