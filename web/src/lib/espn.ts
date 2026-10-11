// Real fixtures, results, standings, head-to-head and DraftKings odds from ESPN's public site API.
// It is unofficial and undocumented, so it can change without notice. Swap to football-data.org
// (fixtures/results) and The Odds API (multi-bookmaker odds) once API keys are available.

export type Competition = { id: string; slug: string; name: string; country: string; logoUrl: string };

export const COMPETITIONS: Competition[] = [
  { id: "PD", slug: "esp.1", name: "LaLiga", country: "Spain" },
  { id: "PL", slug: "eng.1", name: "Premier League", country: "England" },
  { id: "SA", slug: "ita.1", name: "Serie A", country: "Italy" },
  { id: "BL1", slug: "ger.1", name: "Bundesliga", country: "Germany" },
  { id: "FL1", slug: "fra.1", name: "Ligue 1", country: "France" },
  { id: "CL", slug: "uefa.champions", name: "Champions League", country: "Europe" },
].map((c) => ({ ...c, logoUrl: `https://crests.football-data.org/${c.id}.png` }));

const BASE = "https://site.api.espn.com/apis";

// ---------------------------------------------------------------------------------------------------------------
// Small in-memory cache so a page load doesn't refetch everything. Failed requests are not cached.

const cache = new Map<string, { at: number; data: Promise<unknown> }>();

function getJson<T>(url: string, ttlMs: number): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as Promise<T>;
  const data = fetch(url, { cache: "no-store", headers: { accept: "application/json" } }).then((r) => {
    if (!r.ok) throw new Error(`ESPN ${r.status} for ${url}`);
    return r.json();
  });
  cache.set(url, { at: Date.now(), data });
  data.catch(() => cache.delete(url));
  return data as Promise<T>;
}

/** Runs async work over items with limited concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Raw shapes (only the fields we use)

type RawTeam = { id: string; displayName: string; logo?: string; logos?: { href: string }[] };
type RawCompetitor = { homeAway: "home" | "away"; score?: string; form?: string; team: RawTeam };
type RawStatus = { displayClock?: string; type: { name: string; state: "pre" | "in" | "post"; shortDetail: string } };
type RawEvent = { id: string; date: string; status: RawStatus; competitions: { competitors: RawCompetitor[] }[] };
type RawStandingEntry = { team: RawTeam; stats: { name: string; value: number }[] };
type RawOdds = {
  provider?: { name: string };
  overUnder?: number;
  overOdds?: number;
  underOdds?: number;
  homeTeamOdds?: { moneyLine?: number };
  awayTeamOdds?: { moneyLine?: number };
  drawOdds?: { moneyLine?: number };
};
type RawSeriesEvent = {
  date: string;
  statusType?: { completed: boolean };
  competitors: { homeAway: "home" | "away"; score?: string; team: { id: string } }[];
};
type RawSummary = { odds?: RawOdds[]; seasonseries?: { events?: RawSeriesEvent[] }[] };

// ---------------------------------------------------------------------------------------------------------------
// Public shapes

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export type EspnMatch = {
  id: string; // "<competition id lowercase>-<espn event id>"
  eventId: string;
  competition: Competition;
  kickoff: string;
  status: MatchStatus;
  statusDetail: string; // "FT", "63'", "10/14 - 4:45 PM EDT" etc.
  home: { id: string; name: string; crestUrl: string; form: string; score?: number };
  away: { id: string; name: string; crestUrl: string; form: string; score?: number };
};

export type TeamStanding = {
  id: string;
  name: string;
  crestUrl: string;
  competitionId: string;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  rank: number;
};

export type EspnOdds = {
  bookmaker: string;
  home?: number;
  draw?: number;
  away?: number;
  over25?: number;
  under25?: number;
};

export type EspnH2H = { date: string; homeId: string; awayId: string; homeGoals: number; awayGoals: number };

const logoOf = (t: RawTeam) => t.logo ?? t.logos?.[0]?.href ?? "";

function statusOf(s: RawStatus): MatchStatus {
  const name = s.type.name;
  if (name.includes("POSTPONED")) return "postponed";
  if (name.includes("ABANDONED") || name.includes("CANCELED") || name.includes("CANCELLED")) return "cancelled";
  if (s.type.state === "in") return "live";
  if (s.type.state === "post") return "finished";
  return "scheduled";
}

function toMatch(e: RawEvent, comp: Competition): EspnMatch | null {
  const c = e.competitions[0];
  const h = c?.competitors.find((x) => x.homeAway === "home");
  const a = c?.competitors.find((x) => x.homeAway === "away");
  if (!h || !a) return null;
  const status = statusOf(e.status);
  const started = status === "live" || status === "finished";
  const side = (x: RawCompetitor) => ({
    id: x.team.id,
    name: x.team.displayName,
    crestUrl: logoOf(x.team),
    form: x.form ?? "",
    score: started && x.score != null ? Number(x.score) : undefined,
  });
  return {
    id: `${comp.id.toLowerCase()}-${e.id}`,
    eventId: e.id,
    competition: comp,
    kickoff: new Date(e.date).toISOString(),
    status,
    statusDetail: status === "live" ? (e.status.displayClock ?? e.status.type.shortDetail) : e.status.type.shortDetail,
    home: side(h),
    away: side(a),
  };
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** All matches from last month through next month, for every competition. */
export async function fetchMatches(): Promise<EspnMatch[]> {
  const now = new Date();
  const months = [-1, 0, 1].map((o) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + o, 1))));
  const jobs = COMPETITIONS.flatMap((comp) => months.map((m) => ({ comp, m })));
  const results = await mapLimit(jobs, 6, async ({ comp, m }) => {
    try {
      const d = await getJson<{ events?: RawEvent[] }>(`${BASE}/site/v2/sports/soccer/${comp.slug}/scoreboard?dates=${m}`, 5 * 60_000);
      return (d.events ?? []).map((e) => toMatch(e, comp)).filter((x): x is EspnMatch => x !== null);
    } catch {
      return [];
    }
  });
  const byId = new Map(results.flat().map((m) => [m.id, m]));
  return [...byId.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/** League tables for the domestic leagues (the Champions League table is not useful for team strength). */
export async function fetchStandings(): Promise<TeamStanding[]> {
  const leagues = COMPETITIONS.filter((c) => c.id !== "CL");
  const tables = await mapLimit(leagues, 5, async (comp) => {
    try {
      const d = await getJson<{ children?: { standings: { entries: RawStandingEntry[] } }[]; standings?: { entries: RawStandingEntry[] } }>(
        `${BASE}/v2/sports/soccer/${comp.slug}/standings`,
        30 * 60_000,
      );
      const entries = d.children?.[0]?.standings.entries ?? d.standings?.entries ?? [];
      return entries.map((e) => {
        const stat = (n: string) => e.stats.find((s) => s.name === n)?.value ?? 0;
        return {
          id: e.team.id,
          name: e.team.displayName,
          crestUrl: logoOf(e.team),
          competitionId: comp.id,
          played: stat("gamesPlayed"),
          goalsFor: stat("pointsFor"),
          goalsAgainst: stat("pointsAgainst"),
          points: stat("points"),
          rank: stat("rank"),
        };
      });
    } catch {
      return [];
    }
  });
  return tables.flat();
}

const toDecimal = (american?: number) =>
  american == null || american === 0 ? undefined : Math.round((american > 0 ? 1 + american / 100 : 1 + 100 / -american) * 100) / 100;

/** DraftKings odds and the last meetings for one match. */
export async function fetchSummary(match: EspnMatch): Promise<{ odds?: EspnOdds; h2h: EspnH2H[] }> {
  try {
    const d = await getJson<RawSummary>(
      `${BASE}/site/v2/sports/soccer/${match.competition.slug}/summary?event=${match.eventId}`,
      10 * 60_000,
    );
    const o = d.odds?.[0];
    const odds: EspnOdds | undefined = o
      ? {
          bookmaker: o.provider?.name ?? "DraftKings",
          home: toDecimal(o.homeTeamOdds?.moneyLine),
          draw: toDecimal(o.drawOdds?.moneyLine),
          away: toDecimal(o.awayTeamOdds?.moneyLine),
          over25: o.overUnder === 2.5 ? toDecimal(o.overOdds) : undefined,
          under25: o.overUnder === 2.5 ? toDecimal(o.underOdds) : undefined,
        }
      : undefined;
    const h2h = (d.seasonseries?.[0]?.events ?? [])
      .filter((e) => e.statusType?.completed)
      .map((e) => {
        const h = e.competitors.find((c) => c.homeAway === "home");
        const a = e.competitors.find((c) => c.homeAway === "away");
        return {
          date: e.date.slice(0, 10),
          homeId: h?.team.id ?? "",
          awayId: a?.team.id ?? "",
          homeGoals: Number(h?.score ?? 0),
          awayGoals: Number(a?.score ?? 0),
        };
      })
      .slice(0, 5);
    return { odds, h2h };
  } catch {
    return { h2h: [] };
  }
}
