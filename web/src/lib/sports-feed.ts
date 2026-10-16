// Fixtures, live scores and results for the non-football sports, from ESPN's public site API (same unofficial feed
// as football, see espn.ts). No odds or predictions yet. Every sport maps to the shared Match shape, with the score
// in that sport's own format in scoreLine.
import type { SportId } from "@/config/sports";
import { getJson, mapLimit } from "./espn";
import type { League, Match, SideRecord, StatsRadar } from "./types";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const HEADER = "https://site.web.api.espn.com/apis/v2/scoreboard/header";
const TTL = 5 * 60_000;
const DAY = 86_400_000;

type Status = Match["status"];
type RawStatus = {
  period?: number;
  displayClock?: string;
  type: { name: string; state: "pre" | "in" | "post"; shortDetail: string; description?: string };
};
type RawLeague = { name: string; abbreviation?: string; logos?: { href: string }[] };
type RawSide = {
  id: string;
  homeAway?: "home" | "away";
  winner?: boolean;
  score?: string;
  linescores?: { value: number; tiebreak?: number }[];
  athlete?: { displayName: string; flag?: { href: string } };
  team?: { id: string; displayName: string; logo?: string };
  records?: { type: string; summary: string }[];
};
type RawLine = { close?: { odds?: string }; open?: { odds?: string } };
type RawCompetition = {
  id: string;
  date: string;
  status: RawStatus;
  competitors: RawSide[];
  round?: { displayName: string };
  type?: { abbreviation?: string; slug?: string; text?: string };
  odds?: { moneyline?: { home?: RawLine; away?: RawLine } }[];
};
type RawEvent = { id: string; name: string; date: string; status: RawStatus; competitions?: RawCompetition[]; groupings?: { grouping?: { slug?: string }; competitions: RawCompetition[] }[] };
type Scoreboard = { leagues?: RawLeague[]; events?: RawEvent[] };

function statusOf(s: RawStatus): Status {
  const text = `${s.type.name} ${s.type.description ?? ""}`.toUpperCase();
  if (text.includes("POSTPONED")) return "postponed";
  if (/ABANDON|CANCEL|NO RESULT/.test(text)) return "cancelled";
  return s.type.state === "in" ? "live" : s.type.state === "post" ? "finished" : "scheduled";
}

const months = () => {
  const now = new Date();
  return [-1, 0, 1].map((o) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + o, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};

/** The last, current and next month of one ESPN scoreboard, like football. */
async function scoreboards(path: string): Promise<{ league?: RawLeague; events: RawEvent[] }> {
  const boards = await mapLimit(months(), 3, (m) => getJson<Scoreboard>(`${SITE}/${path}/scoreboard?dates=${m}`, TTL).catch(() => ({}) as Scoreboard));
  const events = new Map(boards.flatMap((b) => b.events ?? []).map((e) => [e.id, e]));
  return { league: boards.find((b) => b.leagues?.[0])?.leagues?.[0], events: [...events.values()] };
}

const sideOf = (c: RawCompetition, which: "home" | "away") =>
  c.competitors.find((x) => x.homeAway === which) ?? c.competitors[which === "home" ? 0 : 1];

const winnerOf = (home: RawSide, away: RawSide) => (home.winner ? "home" : away.winner ? "away" : undefined);

/** "overall" / "home" / "road" records ("85-77"), where the feed has them. */
function recordsOf(s: RawSide): SideRecord | undefined {
  const find = (type: string) => s.records?.find((r) => r.type === type)?.summary;
  const r = { overall: find("total"), home: find("home"), road: find("road") };
  return r.overall || r.home || r.road ? r : undefined;
}

/** "-218" / "+180" → decimal odds. */
const americanToDecimal = (american?: string) => {
  const n = Number(american);
  if (!american || !Number.isFinite(n) || n === 0) return undefined;
  return Math.round((n > 0 ? 1 + n / 100 : 1 + 100 / -n) * 100) / 100;
};

/** ESPN's DraftKings moneyline ("close" is the current price until the game starts). */
function bookOddsOf(c: RawCompetition): Match["bookOdds"] {
  const ml = c.odds?.[0]?.moneyline;
  const home = americanToDecimal(ml?.home?.close?.odds);
  const away = americanToDecimal(ml?.away?.close?.odds);
  if (!home || !away) return undefined;
  return { bookmaker: "draftkings", home, away, openHome: americanToDecimal(ml?.home?.open?.odds), openAway: americanToDecimal(ml?.away?.open?.odds) };
}

const person = (s: RawSide) => ({ id: s.id, name: s.athlete?.displayName ?? "TBD", crestUrl: s.athlete?.flag?.href ?? "" });

// ---------------------------------------------------------------------------------------------------------------
// Tennis: ATP and WTA singles. Score = sets from the first player's side, "6-4 3-6 7-6(5)".

const TENNIS_TOURS = [
  { id: "ATP", path: "tennis/atp", name: "ATP Tour", country: "Men's singles", grouping: "mens-singles" },
  { id: "WTA", path: "tennis/wta", name: "WTA Tour", country: "Women's singles", grouping: "womens-singles" },
];

async function tennis(): Promise<Match[]> {
  const tours = await Promise.all(
    TENNIS_TOURS.map(async (tour) => {
      const { events } = await scoreboards(tour.path);
      return events.flatMap((e) =>
        (e.groupings ?? [])
          .filter((g) => g.grouping?.slug === tour.grouping)
          .flatMap((g) => g.competitions)
          .map((c): Match => {
            const [h, a] = [sideOf(c, "home"), sideOf(c, "away")];
            const status = statusOf(c.status);
            const sets = (h.linescores ?? []).map((s, i) => {
              const o = a.linescores?.[i];
              const tb = s.tiebreak ?? o?.tiebreak;
              return `${s.value}-${o?.value ?? 0}${tb != null ? `(${Math.min(s.tiebreak ?? 99, o?.tiebreak ?? 99)})` : ""}`;
            });
            return {
              id: `tennis-${c.id}`,
              sport: "tennis",
              league: tour.name,
              leagueId: tour.id,
              leagueLogo: "",
              kickoff: new Date(c.date).toISOString(),
              home: person(h),
              away: person(a),
              status,
              statusDetail: status === "live" ? `Set ${c.status.period ?? 1}` : c.status.type.shortDetail,
              scoreLine: sets.length && status !== "scheduled" ? sets.join(" ") : undefined,
              winner: winnerOf(h, a),
              round: [e.name, c.round?.displayName].filter(Boolean).join(" · "),
            };
          }),
      );
    }),
  );
  return tours.flat();
}

// ---------------------------------------------------------------------------------------------------------------
// UFC: every fight on every card. ESPN's scoreboard has the round and time a fight ended, but not the method.

async function ufc(): Promise<Match[]> {
  const { league, events } = await scoreboards("mma/ufc");
  return events.flatMap((e) =>
    (e.competitions ?? []).map((c): Match => {
      const [h, a] = [sideOf(c, "home"), sideOf(c, "away")];
      const status = statusOf(c.status);
      return {
        id: `ufc-${c.id}`,
        sport: "ufc",
        league: "UFC",
        leagueId: "UFC",
        leagueLogo: league?.logos?.[0]?.href ?? "",
        kickoff: new Date(c.date).toISOString(),
        home: person(h),
        away: person(a),
        status,
        statusDetail: status === "live" ? `R${c.status.period ?? 1}` : c.status.type.shortDetail,
        scoreLine: status === "finished" && c.status.period ? `R${c.status.period} ${c.status.displayClock ?? ""}`.trim() : undefined,
        winner: winnerOf(h, a),
        round: [e.name, c.type?.abbreviation].filter(Boolean).join(" · "),
        records: { home: recordsOf(h), away: recordsOf(a) },
      };
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Team sports with plain scores: MLB (runs; the inning, "Top 8th", is the live status) and basketball (NBA, WNBA).

const BASKETBALL_LEAGUES = [
  { id: "NBA", path: "basketball/nba", country: "USA" },
  { id: "WNBA", path: "basketball/wnba", country: "USA" },
];

const baseball = () => teamScoreboard("baseball", "baseball/mlb", "MLB");

async function basketball(): Promise<Match[]> {
  return (await Promise.all(BASKETBALL_LEAGUES.map((l) => teamScoreboard("basketball", l.path, l.id)))).flat();
}

async function teamScoreboard(sport: "baseball" | "basketball", path: string, leagueId: string): Promise<Match[]> {
  const { league, events } = await scoreboards(path);
  return events.flatMap((e) => {
    const c = e.competitions?.[0];
    if (!c) return [];
    const [h, a] = [sideOf(c, "home"), sideOf(c, "away")];
    const status = statusOf(c.status);
    const started = status === "live" || status === "finished";
    const team = (s: RawSide) => ({ id: s.team?.id ?? s.id, name: s.team?.displayName ?? "TBD", crestUrl: s.team?.logo ?? "" });
    return [
      {
        id: `${sport}-${e.id}`,
        sport,
        league: leagueId,
        leagueId,
        leagueLogo: league?.logos?.[0]?.href ?? "",
        kickoff: new Date(c.date).toISOString(),
        home: team(h),
        away: team(a),
        status,
        statusDetail: c.status.type.shortDetail,
        score: started && h.score != null && a.score != null ? { home: Number(h.score), away: Number(a.score) } : undefined,
        winner: winnerOf(h, a),
        records: { home: recordsOf(h), away: recordsOf(a) },
        bookOdds: bookOddsOf(c),
      },
    ];
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Cricket: ESPN's scoreboard is per series, so we read the cross-series "header" feed for each day from a week ago
// to a week ahead. Each series is a league in the sidebar. Scores arrive pre-formatted: "198 (46.3/50 ov, target 257)".

type CricketEvent = {
  id: string;
  date: string;
  name: string;
  title?: string;
  status: string;
  fullStatus?: { summary?: string; type?: { state?: string; description?: string; shortDetail?: string } };
  class?: { eventType?: string };
  competitors: { id: string; displayName: string; logo?: string; score?: string; homeAway?: string; winner?: boolean }[];
};
type CricketHeader = { sports?: { leagues?: { id: string; name: string; shortName?: string; events?: CricketEvent[] }[] }[] };

const CRICKET_DAYS = { back: 7, ahead: 7 };

/** "198 (46.3/50 ov, target 257)" → "198 (46.3 ov)" */
const shortCricketScore = (s?: string) => (s ?? "").replace(/, target \d+/, "").replace(/\/\d+ ov/, " ov").trim();

async function cricket(): Promise<Match[]> {
  const today = Date.now();
  const days = Array.from({ length: CRICKET_DAYS.back + CRICKET_DAYS.ahead + 1 }, (_, i) =>
    new Date(today + (i - CRICKET_DAYS.back) * DAY).toISOString().slice(0, 10).replace(/-/g, ""),
  );
  const feeds = await mapLimit(days, 6, (d) => getJson<CricketHeader>(`${HEADER}?sport=cricket&dates=${d}`, TTL).catch(() => ({}) as CricketHeader));
  const out = new Map<string, Match>();
  for (const f of feeds)
    for (const l of f.sports?.[0]?.leagues ?? [])
      for (const e of l.events ?? []) {
        const h = e.competitors.find((c) => c.homeAway === "home") ?? e.competitors[0];
        const a = e.competitors.find((c) => c.homeAway === "away") ?? e.competitors[1];
        if (!h || !a) continue;
        const type = e.fullStatus?.type;
        const status = statusOf({ type: { name: "", state: (type?.state ?? e.status) as RawStatus["type"]["state"], shortDetail: "", description: type?.description } });
        const [hs, as] = [shortCricketScore(h.score), shortCricketScore(a.score)];
        out.set(e.id, {
          id: `cricket-${e.id}`,
          sport: "cricket",
          league: l.shortName ?? l.name,
          leagueId: `cricket-${l.id}`,
          leagueLogo: "",
          kickoff: new Date(e.date).toISOString(),
          home: { id: h.id, name: h.displayName, crestUrl: h.logo ?? "" },
          away: { id: a.id, name: a.displayName, crestUrl: a.logo ?? "" },
          status,
          statusDetail: status === "live" ? "Live" : status === "finished" ? "Result" : type?.shortDetail,
          scoreLine: hs || as ? `${hs || "–"}  v  ${as || "–"}` : undefined,
          winner: h.winner ? "home" : a.winner ? "away" : undefined,
          round: [e.class?.eventType, status === "finished" || status === "live" ? e.fullStatus?.summary : e.title].filter(Boolean).join(" · "),
        });
      }
  return [...out.values()];
}

// ---------------------------------------------------------------------------------------------------------------
// Public

const FEEDS: Record<Exclude<SportId, "football">, () => Promise<Match[]>> = { tennis, ufc, baseball, basketball, cricket };

/** Every match for one non-football sport from last month to next month (cricket: ±1 week), oldest first. */
export async function fetchSportMatches(sport: Exclude<SportId, "football">): Promise<Match[]> {
  try {
    return (await FEEDS[sport]()).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  } catch (e) {
    console.warn(`[sports] ${sport} feed failed:`, e);
    return [];
  }
}

/** The sport's leagues for the sidebar: fixed tours for tennis, one league for UFC and MLB, live series for cricket. */
export async function fetchSportLeagues(sport: Exclude<SportId, "football">): Promise<League[]> {
  const fixed: Partial<Record<SportId, League[]>> = {
    tennis: TENNIS_TOURS.map(({ id, name, country }) => ({ id, name, country, logoUrl: "" })),
    basketball: BASKETBALL_LEAGUES.map(({ id, country }) => ({ id, name: id, country, logoUrl: `https://a.espncdn.com/i/teamlogos/leagues/500/${id.toLowerCase()}.png` })),
  };
  if (fixed[sport]) return fixed[sport];
  const matches = await fetchSportMatches(sport);
  const byId = new Map<string, League & { count: number }>();
  for (const m of matches) {
    const l = byId.get(m.leagueId) ?? { id: m.leagueId, name: m.league, country: sport === "cricket" ? (m.round?.split(" · ")[0] ?? "") : sport === "ufc" ? "Mixed martial arts" : "USA", logoUrl: m.leagueLogo, count: 0 };
    l.count++;
    byId.set(m.leagueId, l);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count).map((l) => ({ id: l.id, name: l.name, country: l.country, logoUrl: l.logoUrl }));
}

// ---------------------------------------------------------------------------------------------------------------
// Stats radar, built only from what the feed gives us. Tennis: each player's results over the last ~6 weeks.
// MLB: season records plus runs in the games we have. UFC and cricket have too little per-side data for a radar.

const clamp = (x: number) => Math.max(5, Math.min(100, Math.round(x)));
const winPct = (record?: string) => {
  const [w, l] = (record ?? "").split("-").map(Number);
  return w + l > 0 ? (100 * w) / (w + l) : undefined;
};

/** Finished games for one side before the given time, newest first, from that side's point of view. */
function history(all: Match[], name: string, before: string) {
  return all
    .filter((m) => m.status === "finished" && m.kickoff < before && (m.home.name === name || m.away.name === name))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .map((m) => ({ m, side: m.home.name === name ? ("home" as const) : ("away" as const) }));
}

function tennisRatings(all: Match[], name: string, before: string): Record<string, number> | null {
  const games = history(all, name, before);
  if (games.length < 2) return null;
  let wins = 0, setsFor = 0, setsAgainst = 0, gamesFor = 0, gamesAgainst = 0;
  for (const { m, side } of games) {
    if (m.winner === side) wins++;
    for (const set of (m.scoreLine ?? "").split(" ")) {
      const [h, a] = set.replace(/\(.*\)/, "").split("-").map(Number);
      if (Number.isNaN(h) || Number.isNaN(a)) continue;
      const [mine, theirs] = side === "home" ? [h, a] : [a, h];
      gamesFor += mine;
      gamesAgainst += theirs;
      if (mine > theirs) setsFor++;
      else if (theirs > mine) setsAgainst++;
    }
  }
  const last5 = games.slice(0, 5);
  return {
    win: clamp((100 * wins) / games.length),
    sets: clamp(setsFor + setsAgainst ? (100 * setsFor) / (setsFor + setsAgainst) : 50),
    games: clamp(gamesFor + gamesAgainst ? 50 + 2.5 * ((100 * gamesFor) / (gamesFor + gamesAgainst) - 50) : 50),
    form: clamp((100 * last5.filter((g) => g.m.winner === g.side).length) / last5.length),
    activity: clamp(games.length * 10),
  };
}

/** Per-game scoring range mapped to 0-100 (low → high): runs for MLB, points for basketball. */
const SCORING = { baseball: { lo: 2, hi: 7 }, basketball: { lo: 100, hi: 125 } };

function teamRatings(all: Match[], m: Match, side: "home" | "away"): Record<string, number> | null {
  const scale = SCORING[m.sport === "basketball" ? "basketball" : "baseball"];
  const rec = m.records?.[side];
  const games = history(all, m[side].name, m.kickoff).filter((g) => g.m.score);
  if (!rec?.overall && games.length < 2) return null;
  const runs = (g: (typeof games)[number]) => (g.side === "home" ? [g.m.score!.home, g.m.score!.away] : [g.m.score!.away, g.m.score!.home]);
  const scored = games.reduce((s, g) => s + runs(g)[0], 0) / (games.length || 1);
  const allowed = games.reduce((s, g) => s + runs(g)[1], 0) / (games.length || 1);
  const last5 = games.slice(0, 5);
  return {
    season: clamp(winPct(rec?.overall) ?? 50),
    venue: clamp(winPct(side === "home" ? rec?.home : rec?.road) ?? 50),
    offence: clamp(games.length ? ((scored - scale.lo) / (scale.hi - scale.lo)) * 100 : 50),
    defence: clamp(games.length ? ((scale.hi - allowed) / (scale.hi - scale.lo)) * 100 : 50),
    form: clamp(last5.length ? (100 * last5.filter((g) => g.m.winner === g.side).length) / last5.length : 50),
  };
}

/** A radar for a non-football match, or null when the feed doesn't have enough data for both sides. */
export async function fetchSportRadar(m: Match): Promise<StatsRadar | null> {
  if (m.sport === "tennis") {
    const all = await fetchSportMatches("tennis");
    const [home, away] = [tennisRatings(all, m.home.name, m.kickoff), tennisRatings(all, m.away.name, m.kickoff)];
    if (!home || !away) return null;
    return {
      axes: [
        { key: "win", label: "Win %" },
        { key: "sets", label: "Sets won" },
        { key: "games", label: "Games won" },
        { key: "form", label: "Last 5" },
        { key: "activity", label: "Matches" },
      ],
      home,
      away,
      note: "Each player's ATP/WTA singles results over the last 6 weeks (ESPN). Games won is stretched around 50% so small edges show.",
    };
  }
  if (m.sport === "baseball" || m.sport === "basketball") {
    const all = await fetchSportMatches(m.sport);
    const [home, away] = [teamRatings(all, m, "home"), teamRatings(all, m, "away")];
    if (!home || !away) return null;
    const unit = m.sport === "baseball" ? "Runs" : "Points";
    return {
      axes: [
        { key: "season", label: "Season W%" },
        { key: "venue", label: "Home/Road W%" },
        { key: "offence", label: `${unit} scored` },
        { key: "defence", label: `${unit} allowed` },
        { key: "form", label: "Last 5" },
      ],
      home,
      away,
      note: `Season records from ESPN; ${unit.toLowerCase()} and form from games in the last 6 weeks. Higher is better on every axis (fewer ${unit.toLowerCase()} allowed scores higher).`,
    };
  }
  return null;
}
