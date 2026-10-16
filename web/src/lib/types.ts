// Data contract between the UI and the backend (see ui-spec.md section 5).
import type { SportId } from "@/config/sports";

export type Team = { id: string; name: string; crestUrl: string };

export type TeamProfile = Team & {
  leagueId: string;
  /** Last 5 results, most recent first. */
  form: FormResult[];
};

export type FormResult = "W" | "D" | "L";

export type League = { id: string; name: string; country: string; logoUrl: string };

export type Match = {
  id: string;
  league: string;
  leagueId: string;
  leagueLogo: string;
  matchday?: number;
  kickoff: string; // ISO
  home: Team;
  away: Team;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  /** Short status from the feed, e.g. "FT" or "63'". */
  statusDetail?: string;
  score?: { home: number; away: number };
  /** Absent = football. Other sports have match-winner odds only, with a market-consensus model. */
  sport?: SportId;
  /** Score in the sport's own format when two numbers don't fit: sets "6-4 3-6 7-5", "R3 5:00", "245/6 – 198". */
  scoreLine?: string;
  winner?: "home" | "away";
  /** Context line under the match: tournament and round, UFC card and weight class, cricket result. */
  round?: string;
  /** DraftKings moneyline from ESPN's scoreboard (decimal), where ESPN lists one: NBA, WNBA, MLB. */
  bookOdds?: { bookmaker: string; home?: number; away?: number; openHome?: number; openAway?: number };
  /** Win-loss records from the feed: MLB season (overall/home/road), UFC career (overall "14-2-1"). */
  records?: { home?: SideRecord; away?: SideRecord };
};

export type SideRecord = { overall?: string; home?: string; road?: string };

/** A stats radar for any sport: axis labels plus 0-100 ratings per side. */
export type StatsRadar = {
  axes: { key: string; label: string }[];
  home: Record<string, number>;
  away: Record<string, number>;
  /** Where the numbers come from, shown under the chart. */
  note: string;
};

export type Market = "1X2" | "OU_2.5" | "BTTS" | "DC" | "CARDS_4.5" | "CORNERS_9.5" | (string & {});

/** live = we have a real odds feed for this book. */
export type Bookmaker = { id: string; name: string; short: string; live?: boolean };
export type BookPrice = { bookmaker: string; odds: number };
export type Confidence = "high" | "medium" | "low";

export type BetPrediction = {
  matchId: string;
  market: Market;
  selection: string; // e.g. "Home", "Over 2.5"
  odds: number; // decimal, best price across bookmakers
  /** Bookmaker offering the best price. */
  bookmaker?: string;
  /** Price at every bookmaker that offers this selection. */
  prices?: BookPrice[];
  impliedProb: number; // 1/odds
  modelProb: number; // 0..1
  ev: number; // modelProb*odds - 1
  confidence: Confidence;
  topFactors?: { feature: string; impact: number }[];
};

export type PastPrediction = BetPrediction & {
  match: Pick<Match, "home" | "away" | "league" | "leagueId">;
  result: "won" | "lost" | "void";
  profit: number; // units, flat 1-unit stake
  settledAt: string;
};

/** A prediction joined with its match, used by lists across pages. */
export type PickWithMatch = BetPrediction & { match: Match };

export type RadarRatings = { attack: number; defence: number; form: number; ppg: number; h2h: number };

export type MatchInsights = {
  /** Model expected goals for each side. */
  expectedGoals?: { home: number; away: number };
  radar: { home: RadarRatings; away: RadarRatings };
  characteristics: {
    home: { strengths: string[]; weaknesses: string[] };
    away: { strengths: string[]; weaknesses: string[] };
  };
  h2h: { date: string; homeId: string; awayId: string; homeGoals: number; awayGoals: number }[];
};

export type MatchDetail = {
  match: Match;
  predictions: BetPrediction[];
  insights: MatchInsights;
  homeForm: FormResult[];
  awayForm: FormResult[];
};

export type CalibrationBin = { predicted: number; actual: number; count: number };
export type Retrain = { version: string; date: string; note: string; logLoss: number };

export type ModelGlance = {
  picksToday: number;
  avgEv: number;
  roi30d: number;
  /** Settled picks behind roi30d. Small samples make ROI very noisy. */
  roi30dPicks: number;
  /** Cumulative profit over the last 30 days, one point per settled pick. */
  roi30dSeries: number[];
};

// ---------------------------------------------------------------- Bet tracker (bet-tracker.md section 6)

export type PickStatus = "pending" | "won" | "lost" | "void";

/** A saved prediction. Everything up to savedAt is a snapshot taken at save time and never changes. */
export type SavedPick = {
  id: string;
  userId: string;
  matchId: string;
  /** Absent = football (picks saved before other sports existed have none). */
  sport?: SportId;
  /** Match snapshot, so the pick still reads correctly after the fixture leaves the live feed. */
  match: { home: Team; away: Team; league: string; leagueId: string; kickoff: string };
  market: string;
  selection: string;
  bookmaker: string;
  oddsAtSave: number;
  modelProb: number;
  impliedProb: number;
  ev: number;
  confidence: Confidence;
  modelVersion: string;
  stake: number; // units
  note?: string;
  tags?: string[];
  savedAt: string;

  status: PickStatus;
  finalScore?: string; // "3-1"
  /** Last price seen just before kickoff: the pick's own bookmaker, or Pinnacle when that book had no price. */
  closingOdds?: number;
  closingBook?: string;
  closingAt?: string;
  clv?: number;
  profit?: number;
  settledAt?: string;
  /** Why a finished match is still pending (e.g. a market we can't settle automatically yet). */
  pendingReason?: string;
};

/** A saved pick plus its live state from the feed (not stored). */
export type TrackedPick = SavedPick & {
  live?: {
    status: Match["status"];
    statusDetail?: string;
    score?: { home: number; away: number };
    currentOdds?: number;
    /** Other sports: score in their own format (tennis sets, UFC round). */
    scoreLine?: string;
  };
};

export type SavePickInput = Pick<
  SavedPick,
  "matchId" | "market" | "selection" | "bookmaker" | "oddsAtSave" | "modelProb" | "impliedProb" | "ev" | "confidence" | "stake" | "note" | "tags"
>;

export type PicksSummary = {
  total: number;
  settled: number;
  pending: number;
  hitRate: number | null;
  profit: number;
  roi: number | null;
  avgClv: number | null;
  streak: { kind: "W" | "L"; length: number } | null;
  profitSeries: { date: string; profit: number }[];
  hitRateByMarket: { market: string; hitRate: number; count: number }[];
  calibration: CalibrationBin[];
};
