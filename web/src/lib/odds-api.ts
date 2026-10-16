// Multi-bookmaker odds from The Odds API (https://the-odds-api.com), enabled by ODDS_API_KEY in web/.env.local.
// Server-only: the key never reaches the browser. Without a key, everything here returns empty and the app keeps
// using ESPN's DraftKings prices alone.
//
// Only the bookmakers in ODDS_API_BOOKMAKERS are fetched (default: five of the most popular books the API carries;
// Bet365 is not available there). Quota: each league request costs one credit per market for up to 10 bookmakers,
// so one refresh of every league (h2h + totals) costs 6 × 2 = 12 credits. Responses are cached for ODDS_API_CACHE_MINUTES.
// Other sports (tennis, UFC, MLB, cricket) fetch match-winner odds only, when that sport is viewed, and are cached for
// ODDS_API_OTHER_SPORTS_CACHE_HOURS (default 6): about 1 credit per sport key per refresh, ~10 keys in all.
import { bookName, bookShort } from "./format";
import type { BookPrice, Bookmaker, Match } from "./types";
import type { SportId } from "@/config/sports";
import type { EspnMatch } from "./espn";

const DEFAULT_BOOKMAKERS = "pinnacle,betfair_ex_eu,williamhill,unibet_se,onexbet";

/** Our competition id → The Odds API sport key. */
const SPORT_KEYS: Record<string, string> = {
  PD: "soccer_spain_la_liga",
  PL: "soccer_epl",
  SA: "soccer_italy_serie_a",
  BL1: "soccer_germany_bundesliga",
  FL1: "soccer_france_ligue_one",
  CL: "soccer_uefa_champs_league",
};

const BASE = "https://api.the-odds-api.com/v4";

type RawOutcome = { name: string; price: number; point?: number };
type RawBookmaker = { key: string; title: string; markets: { key: string; outcomes: RawOutcome[] }[] };
type RawEvent = { id: string; commence_time: string; home_team: string; away_team: string; bookmakers: RawBookmaker[] };

/** Every bookmaker's price for each selection we model. */
export type MatchOdds = { home: BookPrice[]; draw: BookPrice[]; away: BookPrice[]; over25: BookPrice[]; under25: BookPrice[] };

const hasKey = () => Boolean(process.env.ODDS_API_KEY?.trim());

/**
 * Odds sources are chosen per sport group, so football can stay on ESPN's free DraftKings line while the other sports
 * use The Odds API's free plan. FOOTBALL_ODDS_PROVIDER / OTHER_SPORTS_ODDS_PROVIDER: "espn" turns The Odds API off for
 * that group (the key is kept); anything else uses it when ODDS_API_KEY is set.
 */
export const footballOddsApi = () => hasKey() && process.env.FOOTBALL_ODDS_PROVIDER?.trim() !== "espn";
export const otherSportsOddsApi = () => hasKey() && process.env.OTHER_SPORTS_ODDS_PROVIDER?.trim() !== "espn";

/** The Odds API bookmaker keys to show, in display order. */
const bookmakerKeys = () =>
  (process.env.ODDS_API_BOOKMAKERS?.trim() || DEFAULT_BOOKMAKERS)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

const cacheMs = () => Math.max(1, Number(process.env.ODDS_API_CACHE_MINUTES) || 60) * 60_000;

// Kept on globalThis: Next.js can load this module more than once (each route bundle, the background job), and a
// per-module cache meant the same league was fetched, and paid for, once per copy.
const shared = globalThis as typeof globalThis & {
  __oddsApiCache?: Map<string, { at: number; data: Promise<RawEvent[]> }>;
  __oddsApiSports?: { at: number; data: Promise<RawSport[]> };
};
const cache = (shared.__oddsApiCache ??= new Map());

/** Other sports refresh slowly to save credits (free plan): ODDS_API_OTHER_SPORTS_CACHE_HOURS, default 6. */
const otherSportsCacheMs = () => Math.max(1, Number(process.env.ODDS_API_OTHER_SPORTS_CACHE_HOURS) || 6) * 3_600_000;

/** maxAgeMs lets a caller ask for fresher prices than the normal cache (the closing-odds snapshot does). */
function fetchLeague(competitionId: string, maxAgeMs = cacheMs()): Promise<RawEvent[]> {
  const sport = SPORT_KEYS[competitionId];
  return sport ? fetchSportKey(sport, "h2h,totals", Math.min(maxAgeMs, cacheMs())) : Promise.resolve([]);
}

/** One Odds API sport key. Costs one credit per market; cached in memory for ttlMs. */
function fetchSportKey(sport: string, markets: string, ttlMs: number): Promise<RawEvent[]> {
  const key = process.env.ODDS_API_KEY?.trim();
  if (!key) return Promise.resolve([]);
  const hit = cache.get(sport);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;

  const params = new URLSearchParams({
    apiKey: key,
    bookmakers: bookmakerKeys().join(","),
    markets,
    oddsFormat: "decimal",
  });
  const data = fetch(`${BASE}/sports/${sport}/odds?${params}`, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`The Odds API ${r.status} for ${sport}: ${await r.text()}`);
    const remaining = r.headers.get("x-requests-remaining");
    if (remaining != null) console.info(`[odds-api] ${sport} fetched, ${remaining} credits left`);
    return (await r.json()) as RawEvent[];
  });
  cache.set(sport, { at: Date.now(), data });
  data.catch((e) => {
    console.warn(`[odds-api] ${e instanceof Error ? e.message : e}`);
    cache.delete(sport);
  });
  return data;
}

// ---------------------------------------------------------------------------------------------------------------
// Matching ESPN fixtures to Odds API events. Names differ between feeds ("Atlético Madrid" vs "Atletico Madrid",
// "Manchester United" vs "Manchester Utd"), so we compare normalised word sets within a kickoff window.

const STOP = new Set(["fc", "cf", "ac", "as", "sc", "afc", "ssc", "cd", "ud", "rc", "rcd", "sv", "vfl", "vfb", "tsg", "fsv", "de", "the", "club", "calcio", "1"]);

const words = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** 0..1: share of the shorter name's words found (or prefix-matched) in the other name. */
function similarity(a: string, b: string): number {
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return 0;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const hits = short.filter((w) => long.some((v) => v === w || (w.length >= 4 && (v.startsWith(w) || w.startsWith(v)))));
  return hits.length / short.length;
}

const KICKOFF_WINDOW_MS = 3 * 3_600_000;

function findEvent(m: EspnMatch, events: RawEvent[]): RawEvent | undefined {
  const kickoff = new Date(m.kickoff).getTime();
  let best: { e: RawEvent; score: number } | undefined;
  for (const e of events) {
    if (Math.abs(new Date(e.commence_time).getTime() - kickoff) > KICKOFF_WINDOW_MS) continue;
    const h = similarity(m.home.name, e.home_team);
    const a = similarity(m.away.name, e.away_team);
    // Strictly above half, so "Real Sociedad" never matches "Real Madrid" in simultaneous kickoffs.
    if (h <= 0.5 || a <= 0.5) continue;
    if (!best || h + a > best.score) best = { e, score: h + a };
  }
  return best?.e;
}

// ---------------------------------------------------------------------------------------------------------------
// Public

/** Every bookmaker's prices for one match, or undefined when the feed is off or has no matching event. */
export async function fetchOddsApiPrices(m: EspnMatch, opts: { maxAgeMs?: number } = {}): Promise<MatchOdds | undefined> {
  if (!footballOddsApi()) return undefined;
  let events: RawEvent[];
  try {
    events = await fetchLeague(m.competition.id, opts.maxAgeMs);
  } catch {
    return undefined;
  }
  const e = findEvent(m, events);
  if (!e) return undefined;

  const out: MatchOdds = { home: [], draw: [], away: [], over25: [], under25: [] };
  for (const b of e.bookmakers) {
    const push = (list: BookPrice[], price?: number) => {
      if (price && price > 1) list.push({ bookmaker: b.key, odds: price });
    };
    const h2h = b.markets.find((x) => x.key === "h2h")?.outcomes ?? [];
    push(out.home, h2h.find((o) => o.name === e.home_team)?.price);
    push(out.draw, h2h.find((o) => o.name === "Draw")?.price);
    push(out.away, h2h.find((o) => o.name === e.away_team)?.price);
    const totals = (b.markets.find((x) => x.key === "totals")?.outcomes ?? []).filter((o) => o.point === 2.5);
    push(out.over25, totals.find((o) => o.name === "Over")?.price);
    push(out.under25, totals.find((o) => o.name === "Under")?.price);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Other sports: match-winner (h2h) odds only, one credit per sport key per refresh, cached for 6 hours by default.

type RawSport = { key: string; active: boolean; has_outrights: boolean };

/** The Odds API's list of sports. Free (no credits), refreshed with the other-sports cache. */
function activeSports(): Promise<RawSport[]> {
  const key = process.env.ODDS_API_KEY?.trim();
  if (!key) return Promise.resolve([]);
  const sportsList = shared.__oddsApiSports;
  if (sportsList && Date.now() - sportsList.at < otherSportsCacheMs()) return sportsList.data;
  const data = fetch(`${BASE}/sports?apiKey=${key}`, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`The Odds API ${r.status} for /sports`);
    return (await r.json()) as RawSport[];
  });
  shared.__oddsApiSports = { at: Date.now(), data };
  data.catch(() => (shared.__oddsApiSports = undefined));
  return data;
}

/** Which Odds API keys hold each sport. Tennis has one key per tournament, so those are found by prefix. */
const OTHER_SPORT_KEYS: Record<Exclude<SportId, "football">, (key: string) => boolean> = {
  tennis: (k) => k.startsWith("tennis_atp_") || k.startsWith("tennis_wta_"),
  ufc: (k) => k === "mma_mixed_martial_arts",
  baseball: (k) => k === "baseball_mlb",
  // NBA preseason has its own key; EuroLeague and NBL have odds but no ESPN fixtures, so they're skipped.
  basketball: (k) => k === "basketball_nba" || k === "basketball_nba_preseason" || k === "basketball_wnba",
  // International cricket only: ESPN's domestic series have no odds there.
  cricket: (k) => k === "cricket_international_t20" || k === "cricket_odi" || k === "cricket_test_match",
};

/** Tennis and UFC have no real home side, and start times move with the order of play, so the window is wider. */
const OTHER_SPORT_WINDOW_MS = 18 * 3_600_000;

/**
 * Match-winner prices for a non-football match, oriented to ESPN's home/away, or undefined when no event matches.
 * Totals are left empty for now. Cricket Tests can include a draw.
 */
export async function fetchWinnerPrices(m: Match, opts: { maxAgeMs?: number } = {}): Promise<MatchOdds | undefined> {
  if (!otherSportsOddsApi() || !m.sport || m.sport === "football") return undefined;
  const ttl = Math.min(opts.maxAgeMs ?? Infinity, otherSportsCacheMs());
  let events: RawEvent[];
  try {
    const keys = (await activeSports()).filter((s) => s.active && !s.has_outrights && OTHER_SPORT_KEYS[m.sport as Exclude<SportId, "football">](s.key));
    events = (await Promise.all(keys.map((s) => fetchSportKey(s.key, "h2h", ttl).catch(() => [] as RawEvent[])))).flat();
  } catch {
    return undefined;
  }

  // The pair can be listed either way round.
  const kickoff = new Date(m.kickoff).getTime();
  let best: { e: RawEvent; swapped: boolean; score: number } | undefined;
  for (const e of events) {
    if (Math.abs(new Date(e.commence_time).getTime() - kickoff) > OTHER_SPORT_WINDOW_MS) continue;
    for (const swapped of [false, true]) {
      const [eh, ea] = swapped ? [e.away_team, e.home_team] : [e.home_team, e.away_team];
      const h = similarity(m.home.name, eh);
      const a = similarity(m.away.name, ea);
      if (h <= 0.5 || a <= 0.5) continue;
      if (!best || h + a > best.score) best = { e, swapped, score: h + a };
    }
  }
  if (!best) return undefined;

  const { e, swapped } = best;
  const [homeName, awayName] = swapped ? [e.away_team, e.home_team] : [e.home_team, e.away_team];
  const out: MatchOdds = { home: [], draw: [], away: [], over25: [], under25: [] };
  for (const b of e.bookmakers) {
    const h2h = b.markets.find((x) => x.key === "h2h")?.outcomes ?? [];
    const push = (list: BookPrice[], price?: number) => price && price > 1 && list.push({ bookmaker: b.key, odds: price });
    push(out.home, h2h.find((o) => o.name === homeName)?.price);
    push(out.away, h2h.find((o) => o.name === awayName)?.price);
    push(out.draw, h2h.find((o) => o.name === "Draw")?.price);
  }
  return out;
}

/**
 * Match-winner prices for a non-football match, merged from every free source that has it: The Odds API's books
 * (when on) plus ESPN's DraftKings line (NBA, WNBA, MLB). More books make a better no-vig consensus.
 */
export async function winnerPricesFor(m: Match, opts: { maxAgeMs?: number } = {}): Promise<MatchOdds | undefined> {
  const api = await fetchWinnerPrices(m, opts);
  const out: MatchOdds = api ? { ...api, home: [...api.home], away: [...api.away], draw: [...api.draw] } : { home: [], draw: [], away: [], over25: [], under25: [] };
  const o = m.bookOdds;
  if (o?.home && o.away && !out.home.some((x) => x.bookmaker === o.bookmaker)) {
    out.home.push({ bookmaker: o.bookmaker, odds: o.home });
    out.away.push({ bookmaker: o.bookmaker, odds: o.away });
  }
  return out.home.length && out.away.length ? out : undefined;
}

/** Sports whose ESPN scoreboard carries a DraftKings moneyline (free, no key). */
export const ESPN_ODDS_SPORTS: SportId[] = ["football", "baseball", "basketball"];

/** One bookmaker's price for a saved selection, where it offers that market. */
export function bookPriceFor(odds: MatchOdds | undefined, market: string, selection: string, book: string): number | undefined {
  if (!odds) return undefined;
  const pick: Record<string, BookPrice[]> =
    market === "1X2" ? { Home: odds.home, Draw: odds.draw, Away: odds.away }
    : market === "OU_2.5" ? { "Over 2.5": odds.over25, "Under 2.5": odds.under25 }
    : {};
  return pick[selection]?.find((x) => x.bookmaker === book)?.odds;
}

/** The configured Odds API bookmakers, in display order (empty without a key). */
export function oddsApiBookmakers(): Bookmaker[] {
  if (!hasKey()) return [];
  return bookmakerKeys().map((id) => ({ id, name: bookName(id), short: bookShort(id), live: true }));
}
