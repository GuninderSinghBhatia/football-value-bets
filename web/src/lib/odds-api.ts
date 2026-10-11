// Multi-bookmaker odds from The Odds API (https://the-odds-api.com), enabled by ODDS_API_KEY in web/.env.local.
// Server-only: the key never reaches the browser. Without a key, everything here returns empty and the app keeps
// using ESPN's DraftKings prices alone.
//
// Only the bookmakers in ODDS_API_BOOKMAKERS are fetched (default: five of the most popular books the API carries;
// Bet365 is not available there). Quota: each league request costs one credit per market for up to 10 bookmakers,
// so one refresh of every league (h2h + totals) costs 6 × 2 = 12 credits. Responses are cached for ODDS_API_CACHE_MINUTES.
import { bookName, bookShort } from "./format";
import type { BookPrice, Bookmaker } from "./types";
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

export const oddsApiEnabled = () => Boolean(process.env.ODDS_API_KEY?.trim());

/** The Odds API bookmaker keys to show, in display order. */
const bookmakerKeys = () =>
  (process.env.ODDS_API_BOOKMAKERS?.trim() || DEFAULT_BOOKMAKERS)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

const cacheMs = () => Math.max(1, Number(process.env.ODDS_API_CACHE_MINUTES) || 60) * 60_000;

const cache = new Map<string, { at: number; data: Promise<RawEvent[]> }>();

function fetchLeague(competitionId: string): Promise<RawEvent[]> {
  const sport = SPORT_KEYS[competitionId];
  const key = process.env.ODDS_API_KEY?.trim();
  if (!sport || !key) return Promise.resolve([]);
  const hit = cache.get(sport);
  if (hit && Date.now() - hit.at < cacheMs()) return hit.data;

  const params = new URLSearchParams({
    apiKey: key,
    bookmakers: bookmakerKeys().join(","),
    markets: "h2h,totals",
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
export async function fetchOddsApiPrices(m: EspnMatch): Promise<MatchOdds | undefined> {
  if (!oddsApiEnabled()) return undefined;
  let events: RawEvent[];
  try {
    events = await fetchLeague(m.competition.id);
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

/** The configured bookmakers, in display order. */
export function oddsApiBookmakers(): Bookmaker[] {
  if (!oddsApiEnabled()) return [];
  return bookmakerKeys().map((id) => ({ id, name: bookName(id), short: bookShort(id), live: true }));
}
