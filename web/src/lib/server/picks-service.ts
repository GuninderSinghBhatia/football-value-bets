// Bet tracker logic: save, list, remove, summarise and settle picks (bet-tracker.md sections 2-5).
import { fetchMatches, fetchSummary, mapLimit, type EspnMatch, type EspnOdds } from "@/lib/espn";
import { clvFor, profitFor, settleSelection } from "@/lib/settle";
import type { PicksSummary, SavedPick, SavePickInput, TrackedPick } from "@/lib/types";
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

// ---------------------------------------------------------------------------------------------------------------

export async function savePick(input: SavePickInput): Promise<SavedPick> {
  const matches = await fetchMatches();
  const m = matches.find((x) => x.id === input.matchId);
  if (!m) throw new PickError("Match not found", 404);
  if (m.status !== "scheduled") throw new PickError("This match has already started", 409);
  if (!(input.oddsAtSave > 1) || !(input.stake > 0)) throw new PickError("Odds and stake must be positive", 400);

  return updatePicks((picks) => {
    if (picks.some((p) => p.userId === USER_ID && keyOf(p) === keyOf(input))) throw new PickError("Already saved", 409);
    const pick: SavedPick = {
      id: crypto.randomUUID(),
      userId: USER_ID,
      matchId: m.id,
      match: {
        home: { id: m.home.id, name: m.home.name, crestUrl: m.home.crestUrl },
        away: { id: m.away.id, name: m.away.name, crestUrl: m.away.crestUrl },
        league: m.competition.name,
        leagueId: m.competition.id,
        kickoff: m.kickoff,
      },
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
  const matches = await fetchMatches();
  await updatePicks((picks) => {
    const pick = picks.find((p) => p.id === id && p.userId === USER_ID);
    if (!pick) throw new PickError("Pick not found", 404);
    const m = matches.find((x) => x.id === pick.matchId);
    if (pick.status !== "pending" || (m && m.status !== "scheduled"))
      throw new PickError("Only picks for matches that haven't started can be removed", 409);
    return { picks: picks.filter((p) => p.id !== id), result: undefined };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Settlement

let lastSettle = 0;

/** Settles pending picks whose match has finished (or was postponed/abandoned). Safe to run repeatedly. */
export async function settlePending(): Promise<{ checked: number; settled: number; stillPending: number }> {
  lastSettle = Date.now();
  const pending = (await readPicks()).filter((p) => p.status === "pending");
  if (!pending.length) return { checked: 0, settled: 0, stillPending: 0 };

  const matches = new Map((await fetchMatches()).map((m) => [m.id, m]));
  const done = pending.filter((p) => {
    const m = matches.get(p.matchId);
    return m && (m.status === "finished" || m.status === "postponed" || m.status === "cancelled");
  });
  // Closing odds: the last price the feed still lists for the match.
  const closing = new Map<string, EspnOdds | undefined>();
  await mapLimit([...new Set(done.map((p) => p.matchId))], 4, async (id) => {
    closing.set(id, (await fetchSummary(matches.get(id) as EspnMatch)).odds);
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
      if (m.status !== "finished" || m.home.score == null || m.away.score == null) return p;
      // Use 90-minute results only: extra time / penalties change the score feed, so leave those for review.
      if (/AET|PEN/i.test(m.statusDetail)) return { ...p, pendingReason: "Went to extra time: needs the 90-minute score" };
      const outcome = settleSelection(p.market, p.selection, m.home.score, m.away.score);
      if (!outcome) return { ...p, pendingReason: "This market can't be settled automatically yet" };
      const closingOdds = priceFor(closing.get(p.matchId), p.market, p.selection);
      count++;
      return {
        ...p,
        status: outcome,
        finalScore: `${m.home.score}-${m.away.score}`,
        profit: profitFor(outcome, p.stake, p.oddsAtSave),
        closingOdds,
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

  const matches = new Map((await fetchMatches()).map((m) => [m.id, m]));
  // Current odds only matter for picks whose match hasn't started.
  const upcomingIds = [...new Set(picks.filter((p) => matches.get(p.matchId)?.status === "scheduled").map((p) => p.matchId))];
  const current = new Map<string, EspnOdds | undefined>();
  await mapLimit(upcomingIds, 4, async (id) => {
    current.set(id, (await fetchSummary(matches.get(id) as EspnMatch)).odds);
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
          score: m.home.score != null && m.away.score != null ? { home: m.home.score, away: m.away.score } : undefined,
          currentOdds: priceFor(current.get(p.matchId), p.market, p.selection),
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
