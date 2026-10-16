// Shown wherever numbers appear, so it is always clear what is real and what is a placeholder.
export const DATA_SOURCES_NOTE =
  "Fixtures, results and odds are real (ESPN, DraftKings prices). Model % is a placeholder (85% de-vigged market + 15% league-goals baseline; market only for cross-league games) until BetMind's own model is connected.";

/** Data note for non-football sports, depending on whether The Odds API or ESPN's free DraftKings line is on. */
export const otherSportsNote = (oddsApi: boolean) =>
  oddsApi
    ? "Fixtures and results are real (ESPN). Match-winner odds are real: 5 bookmakers from The Odds API (free plan, refreshed every 6 hours) plus DraftKings from ESPN for NBA, WNBA and MLB. Model % is the bookmakers' no-vig consensus until a model for this sport exists."
    : "Fixtures, results and odds are real (ESPN, DraftKings moneyline: NBA, WNBA and MLB only). With a single bookmaker the model % is its own fair price, so there are no value picks until a second odds source or a model for this sport exists.";

export const SAMPLE_DATA_NOTE =
  "Sample data: BetMind hasn't logged any real predictions yet, so this history is illustrative. Real tracking starts once the pipeline logs picks before kickoff.";
