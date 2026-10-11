// Settlement rules for saved picks (bet-tracker.md section 4). Pure functions, no I/O.
// Full-time (90' + stoppage) scores only.

export type Outcome = "won" | "lost" | "void";

/** Decides a selection from the final score. Returns null when the market can't be settled from goals alone. */
export function settleSelection(market: string, selection: string, home: number, away: number): Outcome | null {
  const total = home + away;
  if (market === "1X2") {
    if (selection === "Home") return home > away ? "won" : "lost";
    if (selection === "Draw") return home === away ? "won" : "lost";
    if (selection === "Away") return away > home ? "won" : "lost";
    return null;
  }
  if (market === "DC") {
    if (selection === "Home or Draw") return home >= away ? "won" : "lost";
    if (selection === "Draw or Away") return away >= home ? "won" : "lost";
    if (selection === "Home or Away") return home !== away ? "won" : "lost";
    return null;
  }
  if (market === "BTTS") {
    const both = home > 0 && away > 0;
    if (selection === "Yes") return both ? "won" : "lost";
    if (selection === "No") return both ? "lost" : "won";
    return null;
  }
  // Goal totals: "OU_2.5" with "Over 2.5" / "Under 2.5". Whole lines (e.g. 2.0) can push.
  const ou = /^OU_(\d+(?:\.\d+)?)$/.exec(market);
  if (ou) {
    const line = Number(ou[1]);
    if (total === line) return "void";
    if (selection.startsWith("Over")) return total > line ? "won" : "lost";
    if (selection.startsWith("Under")) return total < line ? "won" : "lost";
    return null;
  }
  // Cards, corners, Asian handicap: need stats we don't fetch yet.
  return null;
}

/** P/L in units for a flat stake. */
export function profitFor(outcome: Outcome, stake: number, odds: number): number {
  const p = outcome === "won" ? stake * (odds - 1) : outcome === "lost" ? -stake : 0;
  return Math.round(p * 100) / 100;
}

/** Closing line value: positive means you got a better price than the market closed at. */
export const clvFor = (oddsAtSave: number, closingOdds: number) => oddsAtSave / closingOdds - 1;
