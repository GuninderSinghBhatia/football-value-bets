// Data contract between the UI and the backend (see ui-spec.md section 5).

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
  closingOdds?: number;
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
