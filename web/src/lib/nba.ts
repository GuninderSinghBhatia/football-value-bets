// NBA player-points props. The Python pipeline (nba/scripts/run_pipeline.py) writes these JSON files to
// web/data/nba/; the web app only reads them and never touches the model. Paper trading only.
export type NbaGameLog = { date: string; opponent: string; home: number; minutes: number; points: number };

export type NbaProp = {
  key: string;
  event_id: string;
  start_time: string;
  espn_athlete_id: string;
  player_id: number | null;
  player: string;
  team: string;
  opponent: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  open_line: number | null;
  book: string;
  taken_at: string;
  injury_status: string | null;
  predicted_points?: number | null;
  sd?: number | null;
  p_over?: number | null;
  p_under?: number | null;
  ev_over?: number | null;
  ev_under?: number | null;
  no_vig_p_over?: number | null;
  pick?: "over" | "under" | null;
  skip_reason?: string | null;
  season_avg_filled?: boolean | null;
  actual_points?: number | null;
  played?: boolean | null;
  last10: NbaGameLog[];
  f_points_last10?: number | null;
  f_points_season_avg?: number | null;
  f_minutes_last10?: number | null;
  f_usage_last10?: number | null;
  f_missing_pts?: number | null;
  f_opp_def_rating_last10?: number | null;
  f_rest_days?: number | null;
};

export type NbaGame = {
  event_id: string;
  start_time: string;
  state: "pre" | "in" | "post";
  status: string;
  home: string;
  away: string;
  home_name: string;
  away_name: string;
  home_score: number;
  away_score: number;
  props: NbaProp[];
};

export type NbaTonight = { generated_at: string; model_version: string; ev_threshold: number; games: NbaGame[] };

export type NbaBet = {
  bet_id: string;
  placed_at: string;
  event_id: string;
  start_time: string;
  player_id: number;
  player: string;
  team: string;
  opponent: string;
  side: "over" | "under";
  line: number;
  odds: number;
  decimal: number;
  p_side: number;
  ev: number;
  predicted_points: number;
  book: string;
  stake: number;
  season_start?: boolean | null;
  status: "open" | "won" | "lost" | "void";
  close_line: number | null;
  close_over_odds: number | null;
  close_under_odds: number | null;
  actual_points: number | null;
  profit: number | null;
  clv: number | null;
  settled_at: string | null;
};

export type NbaPerformance = {
  generated_at: string;
  model_version: string;
  ev_threshold: number;
  summary: {
    bets: number;
    open: number;
    void: number;
    settled: number;
    won: number;
    win_rate: number | null;
    profit: number;
    roi: number | null;
    roi_ci95: [number, number] | null;
    max_drawdown: number;
    avg_clv: number | null;
    positive_clv_share: number | null;
    avg_ev: number | null;
  };
  curve: { date: string; profit: number }[];
  by_month: { period: string; bets: number; profit: number; roi: number; avg_clv: number | null }[];
  gate2: {
    n: number;
    model_mae?: number;
    line_mae?: number;
    model_logloss?: number;
    line_logloss?: number;
    over_rate?: number;
    passes?: boolean;
  };
};

/** "-113" / "+105" */
export const american = (x: number | null | undefined) => (x == null ? "–" : x > 0 ? `+${x}` : `${x}`);

/** EV of the side the model leans to (the pick, or the better side when there's no pick). */
export function bestSide(p: NbaProp): { side: "over" | "under"; ev: number } | null {
  if (p.ev_over == null || p.ev_under == null) return null;
  return p.ev_over >= p.ev_under ? { side: "over", ev: p.ev_over } : { side: "under", ev: p.ev_under };
}
