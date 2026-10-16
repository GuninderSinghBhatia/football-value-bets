// Bet tracker logic: save, list, remove, summarise and settle picks (bet-tracker.md sections 2-5).
import { sportOfMatchId } from "@/config/sports";
import { fetchMatches, fetchSummary, mapLimit, type EspnMatch, type EspnOdds } from "@/lib/espn";
import { bookPriceFor, fetchOddsApiPrices, winnerPricesFor, type MatchOdds } from "@/lib/odds-api";
import { clvFor, profitFor, settleSelection } from "@/lib/settle";
import { fetchSportMatches } from "@/lib/sports-feed";
import type { Match, PicksSummary, SavedPick, SavePickInput, TrackedPick } from "@/lib/types";
import { readPicks, updatePicks } from "./picks-store";

export const USER_ID = "local"; // single user until accounts exist
export const MODEL_VERSION = "placeholder-baseline-v1";

export class PickError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const keyOf = (p: Pick<SavedPick, "matchId" | "market" | "selection">) => `${p.matchId}|${p.market}|${p.selection}`;

/** Price for a selection from the feed's odds, where we have that market. */
function priceFor(odds: EspnOdds | undefined, market: string, selection: string): number | undefined {
  if (!odds) return undefined;
  if (market === "1X2") return selection === "Home" ? odds.home : selection === "Draw" ? odds.draw : odds.away;
  if (market === "OU_2.5") return selection === "Over 2.5" ? odds.over25 : odds.under25;
  return undefined;
}

/** Picks saved at DraftKings come from ESPN's feed; every other book comes from The Odds API. */
const isEspnPick = (p: SavedPick) => p.bookmaker === "draftkings";

const FALLBACK_BOOK = "pinnacle"; // sharpest market, used when the pick's own book has no closing price

/** Odds API price for a pick at its own book, else at Pinnacle. */
function oddsApiPriceFor(odds: MatchOdds | undefined, p: SavedPick): { odds: number; book: string } | undefined {
  const own = bookPriceFor(odds, p.market, p.selection, p.bookmaker);
  if (own) return { odds: own, book: p.bookmaker };
  const fallback = bookPriceFor(odds, p.market, p.selection, FALLBACK_BOOK);
  return fallback ? { odds: fallback, book: FALLBACK_BOOK } : undefined;
}

/** A pick's match in one shape for every sport: football from ESPN's soccer feed, the rest from sports-feed. */
type Tracked = {
  status: Match["status"];
  statusDetail: string;
  home?: number;
  away?: number;
  winner?: "home" | "away";
  scoreLine?: string;
  round?: string;
  espn?: EspnMatch;
  other?: Match;
};

async function trackedMatches(matchIds: string[]): Promise<Map<string, Tracked>> {
  const out = new Map<string, Tracked>();
  const sports = new Set(matchIds.map(sportOfMatchId));
  if (sports.has("football"))
    for (const m of await fetchMatches())
      out.set(m.id, { status: m.status, statusDetail: m.statusDetail, home: m.home.score, away: m.away.score, espn: m });
  for (const sport of sports) {
    if (sport === "football") continue;
    for (const m of await fetchSportMatches(sport))
      out.set(m.id, {
        status: m.status,
        statusDetail: m.statusDetail ?? "",
        home: m.score?.home,
        away: m.score?.away,
        winner: m.winner,
        scoreLine: m.scoreLine,
        round: m.round,
        other: m,
      });
  }
  return out;
}

/** Live prices for a tracked match: Odds API markets for football, match winner (Odds API or ESPN) for other sports. */
function apiPrices(t: Tracked, opts: { maxAgeMs?: number } = {}): Promise<MatchOdds | undefined> {
  if (t.espn) return fetchOddsApiPrices(t.espn, opts);
  if (t.other) return winnerPricesFor(t.other, opts);
  return Promise.resolve(undefined);
}

/** Football DraftKings picks take closing odds from ESPN's match summary; every other pick uses the snapshot. */
const usesEspnSummary = (p: SavedPick) => isEspnPick(p) && sportOfMatchId(p.matchId) === "football";

/** Other sports settle on the feed's winner (or runs, for MLB); a draw only counts when the result says so. */
function settleOther(p: SavedPick, t: Tracked): ReturnType<typeof settleSelection> {
  if (p.market !== "1X2") return null;
  if (t.home != null && t.away != null && !t.winner) return settleSelection(p.market, p.selection, t.home, t.away);
  if (t.winner) return p.selection.toLowerCase() === t.winner ? "won" : "lost";
  if (/draw|tied?\b/i.test(t.round ?? "")) return p.selection === "Draw" ? "won" : "lost";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------

export async function savePick(input: SavePickInput): Promise<SavedPick> {
  const sport = sportOfMatchId(input.matchId);
  const m = sport === "football" ? undefined : (await fetchSportMatches(sport)).find((x) => x.id === input.matchId);
  const espn = sport === "football" ? (await fetchMatches()).find((x) => x.id === input.matchId) : undefined;
  const snapshot = espn
    ? {
        status: espn.status,
        match: {
          home: { id: espn.home.id, name: espn.home.name, crestUrl: espn.home.crestUrl },
          away: { id: espn.away.id, name: espn.away.name, crestUrl: espn.away.crestUrl },
          league: espn.competition.name,
          leagueId: espn.competition.id,
          kickoff: espn.kickoff,
        },
      }
    : m
      ? { status: m.status, match: { home: m.home, away: m.away, league: m.league, leagueId: m.leagueId, kickoff: m.kickoff } }
      : undefined;
  if (!snapshot) throw new PickError("Match not found", 404);
  if (snapshot.status !== "scheduled") throw new PickError("This match has already started", 409);
  if (!(input.oddsAtSave > 1) || !(input.stake > 0)) throw new PickError("Odds and stake must be positive", 400);

  return updatePicks((picks) => {
    if (picks.some((p) => p.userId === USER_ID && keyOf(p) === keyOf(input))) throw new PickError("Already saved", 409);
    const pick: SavedPick = {
      id: crypto.randomUUID(),
      userId: USER_ID,
      matchId: input.matchId,
      sport: sport === "football" ? undefined : sport,
      match: snapshot.match,
      market: input.market,
      selection: input.selection,
      bookmaker: input.bookmaker,
      oddsAtSave: input.oddsAtSave,
      modelProb: input.modelProb,
      impliedProb: input.impliedProb,
      ev: input.ev,
      confidence: input.confidence,
      modelVersion: MODEL_VERSION,
      stake: Math.round(input.stake * 100) / 100,
      note: input.note?.trim() || undefined,
      tags: input.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
      savedAt: new Date().toISOString(),
      status: "pending",
    };
    return { picks: [...picks, pick], result: pick };
  });
}

export async function removePick(id: string): Promise<void> {
  const target = (await readPicks()).find((p) => p.id === id);
  const matches = await trackedMatches(target ? [target.matchId] : []);
  await updatePicks((picks) => {
    const pick = picks.find((p) => p.id === id && p.userId === USER_ID);
    if (!pick) throw new PickError("Pick not found", 404);
    const m = matches.get(pick.matchId);
    if (pick.status !== "pending" || (m && m.status !== "scheduled"))
      throw new PickError("Only picks for matches that haven't started can be removed", 409);
    return { picks: picks.filter((p) => p.id !== id), result: undefined };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Settlement

let lastSettle = 0;

// Closing odds snapshot. The Odds API drops pre-match prices at kickoff, so the closing price has to be captured
// beforehand: every run, picks kicking off within the window get a fresh price (at most SNAPSHOT_MAX_AGE old) from
// their own bookmaker, overwriting the previous snapshot. The last one taken before kickoff is the closing price.
// The job runs every 15 minutes, so a 25-minute window catches every match at least once. Each fresh league fetch
// costs 2 credits, and only leagues with a pick about to kick off are fetched.
const SNAPSHOT_WINDOW_MS = 25 * 60_000;
const SNAPSHOT_MAX_AGE_MS = 10 * 60_000;

async function snapshotClosing(matches: Map<string, Tracked>): Promise<number> {
  const now = Date.now();
  const due = (await readPicks()).filter((p) => {
    const m = matches.get(p.matchId);
    const untilKickoff = Date.parse(p.match.kickoff) - now;
    return p.status === "pending" && !usesEspnSummary(p) && m?.status === "scheduled" && untilKickoff > 0 && untilKickoff <= SNAPSHOT_WINDOW_MS;
  });
  if (!due.length) return 0;

  const prices = new Map<string, MatchOdds | undefined>();
  await mapLimit([...new Set(due.map((p) => p.matchId))], 4, async (id) => {
    prices.set(id, await apiPrices(matches.get(id)!, { maxAgeMs: SNAPSHOT_MAX_AGE_MS }));
  });

  const at = new Date().toISOString();
  const ids = new Set(due.map((p) => p.id));
  return updatePicks((picks) => {
    let count = 0;
    const next = picks.map((p) => {
      if (!ids.has(p.id) || p.status !== "pending") return p;
      const price = oddsApiPriceFor(prices.get(p.matchId), p);
      if (!price) return p;
      count++;
      return { ...p, closingOdds: price.odds, closingBook: price.book, closingAt: at };
    });
    return { picks: next, result: count };
  });
}

/** Settles pending picks whose match has finished (or was postponed/abandoned). Safe to run repeatedly. */
export async function settlePending(): Promise<{ checked: number; settled: number; stillPending: number }> {
  lastSettle = Date.now();
  const open = (await readPicks()).filter((p) => p.status === "pending");
  if (!open.length) return { checked: 0, settled: 0, stillPending: 0 };

  const matches = await trackedMatches(open.map((p) => p.matchId));
  await snapshotClosing(matches).catch((e) => console.warn("[settle] closing snapshot failed:", e));

  const pending = (await readPicks()).filter((p) => p.status === "pending");
  const done = pending.filter((p) => {
    const m = matches.get(p.matchId);
    return m && (m.status === "finished" || m.status === "postponed" || m.status === "cancelled");
  });
  // DraftKings picks (ESPN feed, no Odds API key): closing odds are the last price ESPN still lists for the match.
  const espnClosing = new Map<string, EspnOdds | undefined>();
  await mapLimit([...new Set(done.filter(usesEspnSummary).map((p) => p.matchId))], 4, async (id) => {
    const espn = matches.get(id)?.espn;
    if (espn) espnClosing.set(id, (await fetchSummary(espn)).odds);
  });

  const now = new Date().toISOString();
  const settled = await updatePicks((picks) => {
    let count = 0;
    const next = picks.map((p) => {
      if (p.status !== "pending") return p;
      const m = matches.get(p.matchId);
      if (!m) return p;
      if (m.status === "postponed" || m.status === "cancelled") {
        count++;
        return { ...p, status: "void" as const, profit: 0, settledAt: now, pendingReason: undefined };
      }
      if (m.status !== "finished") return p;
      let outcome: ReturnType<typeof settleSelection>;
      if (m.espn) {
        if (m.home == null || m.away == null) return p;
        // Use 90-minute results only: extra time / penalties change the score feed, so leave those for review.
        if (/AET|PEN/i.test(m.statusDetail)) return { ...p, pendingReason: "Went to extra time: needs the 90-minute score" };
        outcome = settleSelection(p.market, p.selection, m.home, m.away);
      } else outcome = settleOther(p, m);
      if (!outcome) return { ...p, pendingReason: "This market can't be settled automatically yet" };
      // Odds API picks keep the pre-kickoff snapshot (undefined if none was taken, e.g. the server was off).
      const closingOdds = usesEspnSummary(p) ? priceFor(espnClosing.get(p.matchId), p.market, p.selection) : p.closingOdds;
      count++;
      return {
        ...p,
        status: outcome,
        finalScore: m.scoreLine ?? (m.home != null && m.away != null ? `${m.home}-${m.away}` : undefined),
        profit: profitFor(outcome, p.stake, p.oddsAtSave),
        closingOdds,
        closingBook: usesEspnSummary(p) ? (closingOdds ? p.bookmaker : undefined) : p.closingBook,
        clv: closingOdds ? clvFor(p.oddsAtSave, closingOdds) : undefined,
        settledAt: now,
        pendingReason: undefined,
      };
    });
    return { picks: next, result: count };
  });
  return { checked: pending.length, settled, stillPending: pending.length - settled };
}

/** Settle at most every 2 minutes when picks are listed, so the page is fresh without a separate job. */
async function settleIfStale() {
  if (Date.now() - lastSettle > 2 * 60_000) await settlePending().catch(() => {});
}

// ---------------------------------------------------------------------------------------------------------------
// Listing and summary

export type PickFilters = { status?: string; league?: string; from?: string; to?: string };

export async function listPicks(filters: PickFilters = {}): Promise<TrackedPick[]> {
  await settleIfStale();
  const fromT = filters.from ? Date.parse(filters.from) : -Infinity;
  const toT = filters.to ? Date.parse(filters.to) : Infinity;
  const picks = (await readPicks())
    .filter((p) => p.userId === USER_ID)
    .filter((p) => !filters.status || p.status === filters.status)
    .filter((p) => !filters.league || p.match.leagueId === filters.league)
    .filter((p) => {
      const t = Date.parse(p.match.kickoff);
      return t >= fromT && t <= toT;
    });

  const matches = await trackedMatches(picks.map((p) => p.matchId));
  // Current odds only matter for picks whose match hasn't started.
  const upcomingIds = [...new Set(picks.filter((p) => matches.get(p.matchId)?.status === "scheduled").map((p) => p.matchId))];
  const current = new Map<string, EspnOdds | undefined>();
  const currentApi = new Map<string, MatchOdds | undefined>();
  await mapLimit(upcomingIds, 4, async (id) => {
    const m = matches.get(id)!;
    const forMatch = picks.filter((p) => p.matchId === id);
    if (forMatch.some(usesEspnSummary)) current.set(id, (await fetchSummary(m.espn!)).odds);
    if (forMatch.some((p) => !usesEspnSummary(p))) currentApi.set(id, await apiPrices(m));
  });

  return picks
    .map((p): TrackedPick => {
      const m = matches.get(p.matchId);
      if (!m) return p;
      return {
        ...p,
        live: {
          status: m.status,
          statusDetail: m.statusDetail,
          score: m.home != null && m.away != null ? { home: m.home, away: m.away } : undefined,
          scoreLine: m.scoreLine,
          // Same book as the pick, so the movement shown is like-for-like (no Pinnacle fallback here).
          currentOdds: usesEspnSummary(p)
            ? priceFor(current.get(p.matchId), p.market, p.selection)
            : bookPriceFor(currentApi.get(p.matchId), p.market, p.selection, p.bookmaker),
        },
      };
    })
    .sort((a, b) => b.match.kickoff.localeCompare(a.match.kickoff));
}

export function summarise(picks: SavedPick[]): PicksSummary {
  const settled = picks.filter((p) => p.status !== "pending").sort((a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? ""));
  const decided = settled.filter((p) => p.status === "won" || p.status === "lost");
  const won = decided.filter((p) => p.status === "won").length;
  const staked = decided.reduce((s, p) => s + p.stake, 0);
  const profit = settled.reduce((s, p) => s + (p.profit ?? 0), 0);
  const withClv = settled.filter((p) => p.clv != null);

  let streak: PicksSummary["streak"] = null;
  for (const p of [...decided].reverse()) {
    const kind = p.status === "won" ? "W" : "L";
    if (!streak) streak = { kind, length: 1 };
    else if (streak.kind === kind) streak.length++;
    else break;
  }

  let running = 0;
  const profitSeries = settled.map((p) => ({
    date: new Date(p.match.kickoff).toISOString().slice(0, 10),
    profit: Math.round((running += p.profit ?? 0) * 100) / 100,
  }));

  const markets = [...new Set(decided.map((p) => p.market))];
  const hitRateByMarket = markets.map((market) => {
    const list = decided.filter((p) => p.market === market);
    return { market, count: list.length, hitRate: list.filter((p) => p.status === "won").length / list.length };
  });

  // Calibration in 10-point bins of model probability.
  const bins = new Map<number, { sumP: number; hits: number; count: number }>();
  for (const p of decided) {
    const b = Math.min(9, Math.floor(p.modelProb * 10));
    const bin = bins.get(b) ?? { sumP: 0, hits: 0, count: 0 };
    bin.sumP += p.modelProb;
    bin.count++;
    if (p.status === "won") bin.hits++;
    bins.set(b, bin);
  }
  const calibration = [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]) => ({ predicted: b.sumP / b.count, actual: b.hits / b.count, count: b.count }));

  return {
    total: picks.length,
    settled: settled.length,
    pending: picks.length - settled.length,
    hitRate: decided.length ? won / decided.length : null,
    profit: Math.round(profit * 100) / 100,
    roi: staked ? profit / staked : null,
    avgClv: withClv.length ? withClv.reduce((s, p) => s + (p.clv ?? 0), 0) / withClv.length : null,
    streak,
    profitSeries,
    hitRateByMarket,
    calibration,
  };
}

export async function getSummary(): Promise<PicksSummary> {
  await settleIfStale();
  return summarise((await readPicks()).filter((p) => p.userId === USER_ID));
}
