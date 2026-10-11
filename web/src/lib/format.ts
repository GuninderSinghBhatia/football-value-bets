import type { Market } from "./types";

/** Probabilities and EV as percentages with 1 decimal. */
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`;
export const odds = (x: number) => x.toFixed(2);
export const units = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}u`;

export const MARKET_LABELS: Record<string, string> = {
  "1X2": "Match result",
  "OU_2.5": "Over/Under 2.5",
  BTTS: "Both teams to score",
  DC: "Double chance",
  "CARDS_4.5": "Total cards 4.5",
  "CORNERS_9.5": "Total corners 9.5",
};
export const marketLabel = (m: Market) => MARKET_LABELS[m] ?? m;

/** Human label for a selection, e.g. "Home" → "Real Madrid win". */
export function selectionLabel(market: Market, selection: string, home?: string, away?: string): string {
  if (market === "1X2") {
    if (selection === "Home") return home ? `${home} win` : "Home win";
    if (selection === "Away") return away ? `${away} win` : "Away win";
    return "Draw";
  }
  if (market === "BTTS") return `BTTS: ${selection}`;
  if (market === "OU_2.5") return `${selection} goals`;
  if (market === "CARDS_4.5") return `${selection} cards`;
  if (market === "CORNERS_9.5") return `${selection} corners`;
  return selection;
}

/** Short tag label, e.g. "Home Win", "Over 2.5". */
export function shortSelection(market: Market, selection: string): string {
  if (market === "1X2") return selection === "Draw" ? "Draw" : `${selection} Win`;
  if (market === "BTTS") return `BTTS ${selection}`;
  if (market === "CARDS_4.5") return `${selection} cards`;
  if (market === "CORNERS_9.5") return `${selection} corners`;
  return selection;
}

/** Display names for bookmaker ids (ESPN + The Odds API keys); unknown ids fall back to the id itself. */
export const BOOK_NAMES: Record<string, string> = {
  draftkings: "DraftKings",
  pinnacle: "Pinnacle",
  betfair_ex_eu: "Betfair",
  betfair_ex_uk: "Betfair",
  betfair_sb_uk: "Betfair Sportsbook",
  williamhill: "William Hill",
  onexbet: "1xBet",
  sport888: "888sport",
  unibet_eu: "Unibet",
  unibet_uk: "Unibet",
  unibet_se: "Unibet",
  unibet_nl: "Unibet",
  unibet_fr: "Unibet",
  marathonbet: "Marathon Bet",
  betsson: "Betsson",
  nordicbet: "NordicBet",
  coolbet: "Coolbet",
  paddypower: "Paddy Power",
  skybet: "Sky Bet",
  ladbrokes_uk: "Ladbrokes",
  coral: "Coral",
  betvictor: "BetVictor",
  matchbook: "Matchbook",
  smarkets: "Smarkets",
  betway: "Betway",
  boylesports: "BoyleSports",
  grosvenor: "Grosvenor",
  leovegas: "LeoVegas",
  livescorebet: "LiveScore Bet",
};
export const bookName = (id: string) => BOOK_NAMES[id] ?? id;

/** Two-letter badge for a bookmaker, e.g. "Paddy Power" → "PP", "Pinnacle" → "PI". */
export function bookShort(id: string, name = bookName(id)): string {
  if (id === "draftkings") return "DK";
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

const dayKey =(d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** "today" | "tomorrow" | "week" | "later", in the viewer's local time. */
export function dateBucket(iso: string, now = new Date()): "today" | "tomorrow" | "week" | "later" {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return "today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dayKey(d) === dayKey(tomorrow)) return "tomorrow";
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return d < weekEnd ? "week" : "later";
}
