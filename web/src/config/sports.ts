// Sports shown in the sport switcher. Single source of truth: adding a sport starts with one line here,
// plus its feed in lib/sports-feed.ts and its Odds API keys in lib/odds-api.ts. Football has the full model; the
// others have match-winner odds with a market-consensus model.

export const SPORTS = [
  { id: "football", label: "Football", icon: "⚽", markets: ["1X2", "Over/Under goals", "BTTS"] },
  { id: "tennis", label: "Tennis", icon: "🎾", markets: ["Match winner", "Set betting", "Total games"] },
  { id: "ufc", label: "UFC", icon: "🥊", markets: ["Fight winner", "Method (KO/Sub/Decision)", "Total rounds"] },
  { id: "baseball", label: "Baseball", icon: "⚾", markets: ["Moneyline", "Run line", "Total runs"] },
  { id: "basketball", label: "Basketball", icon: "🏀", markets: ["Moneyline", "Point spread", "Total points"] },
  { id: "cricket", label: "Cricket", icon: "🏏", markets: ["Match winner", "Top batter", "Total runs"] },
] as const;

export type SportId = (typeof SPORTS)[number]["id"];

export const DEFAULT_SPORT: SportId = "football";

export const parseSport = (value: string | null | undefined): SportId =>
  SPORTS.some((s) => s.id === value) ? (value as SportId) : DEFAULT_SPORT;

export const sportOf = (id: SportId) => SPORTS.find((s) => s.id === id) ?? SPORTS[0];

/** Non-football match ids start with the sport id ("tennis-123"); football ids start with a league id ("pl-123"). */
export const sportOfMatchId = (matchId: string): SportId =>
  SPORTS.find((s) => s.id !== "football" && matchId.startsWith(`${s.id}-`))?.id ?? DEFAULT_SPORT;
