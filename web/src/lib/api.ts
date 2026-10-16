// The only data source for the UI.
//   Real:   fixtures, results, live scores, crests, form, league tables, head-to-head and DraftKings odds (ESPN),
//           plus multi-bookmaker odds from The Odds API when ODDS_API_KEY is set (lib/odds-api.ts).
//   Placeholder: model probabilities come from lib/baseline.ts until BetMind's own model exists.
//   Sample: the settled-pick history and calibration (Performance page), because nothing has been tracked yet.
import modelJson from "@/mocks/model.json";
import pastJson from "@/mocks/past-predictions.json";
import { factorsFor, predict, strengths, type Strength } from "./baseline";
import { COMPETITIONS, fetchMatches, fetchStandings, fetchSummary, mapLimit, type EspnMatch, type EspnOdds } from "./espn";
import { ESPN_ODDS_SPORTS, fetchOddsApiPrices, footballOddsApi, oddsApiBookmakers, otherSportsOddsApi, winnerPricesFor, type MatchOdds } from "./odds-api";
import { fetchSportLeagues, fetchSportMatches, fetchSportRadar } from "./sports-feed";
import { DEFAULT_SPORT, sportOfMatchId, type SportId } from "@/config/sports";
import type {
  BetPrediction,
  BookPrice,
  Bookmaker,
  CalibrationBin,
  Confidence,
  FormResult,
  League,
  Match,
  MatchDetail,
  MatchInsights,
  ModelGlance,
  PastPrediction,
  PickWithMatch,
  RadarRatings,
  Retrain,
  StatsRadar,
  TeamProfile,
} from "./types";

/** Picks need at least this much expected value to count as value bets. */
export const MIN_VALUE_EV = 0.02;
const UPCOMING_DAYS = 7;
/** Share of the goals baseline in the placeholder model; the rest is the de-vigged market price. */
const BASELINE_WEIGHT = 0.15;
const DAY = 86_400_000;


// ---------------------------------------------------------------------------------------------------------------
// Mapping

const toMatch = (m: EspnMatch): Match => ({
  id: m.id,
  league: m.competition.name,
  leagueId: m.competition.id,
  leagueLogo: m.competition.logoUrl,
  kickoff: m.kickoff,
  home: { id: m.home.id, name: m.home.name, crestUrl: m.home.crestUrl },
  away: { id: m.away.id, name: m.away.name, crestUrl: m.away.crestUrl },
  status: m.status,
  statusDetail: m.statusDetail,
  score: m.home.score != null && m.away.score != null ? { home: m.home.score, away: m.away.score } : undefined,
});

const parseForm = (form: string): FormResult[] =>
  [...form.toUpperCase()].filter((c): c is FormResult => c === "W" || c === "D" || c === "L").slice(-5);

async function load() {
  const [matches, table] = await Promise.all([fetchMatches(), fetchStandings()]);
  const s = strengths(table);
  const leagueAvgs = [...s.avgGoals.values()];
  const overallAvg = leagueAvgs.length ? leagueAvgs.reduce((a, b) => a + b, 0) / leagueAvgs.length : 1.4;
  return { matches, table, s, avgFor: (m: EspnMatch) => s.avgGoals.get(m.competition.id) ?? overallAvg };
}
type Loaded = Awaited<ReturnType<typeof load>>;

const isUpcoming = (m: EspnMatch, now = Date.now()) =>
  m.status === "scheduled" && new Date(m.kickoff).getTime() > now && new Date(m.kickoff).getTime() < now + UPCOMING_DAYS * DAY;

/** Thin data makes the baseline unreliable, so confidence is capped when a team has played few games. */
function confidence(p: number, home?: Strength, away?: Strength): Confidence {
  if (!home || !away || home.played < 4 || away.played < 4) return "low";
  return p >= 0.55 ? "high" : p >= 0.35 ? "medium" : "low";
}

/** The configured bookmakers from The Odds API when ODDS_API_KEY is set, otherwise DraftKings (ESPN). */
async function pricesFor(m: EspnMatch, espnOdds: EspnOdds | undefined): Promise<MatchOdds> {
  const out: MatchOdds = { home: [], draw: [], away: [], over25: [], under25: [] };
  if (footballOddsApi()) return (await fetchOddsApiPrices(m)) ?? out;
  if (espnOdds) {
    const book = espnOdds.bookmaker.toLowerCase().replace(/\s+/g, "");
    for (const k of Object.keys(out) as (keyof MatchOdds)[]) {
      const price = espnOdds[k];
      if (price && price > 1) out[k].push({ bookmaker: book, odds: price });
    }
  }
  return out;
}

/** Real bookmaker prices for one match, with the baseline's probabilities and EV against the best price. */
async function predictionsFor(m: EspnMatch, data: Loaded) {
  const { odds: espnOdds, h2h } = await fetchSummary(m);
  const prices = await pricesFor(m, espnOdds);
  const hs = data.s.byTeam.get(m.home.id);
  const as = data.s.byTeam.get(m.away.id);
  const p = predict(hs, as, data.avgFor(m));
  const rows: BetPrediction[] = [];
  const add = (market: string, selection: string, list: BookPrice[], prob: number) => {
    const best = list.reduce<BookPrice | undefined>((x, y) => (!x || y.odds > x.odds ? y : x), undefined);
    if (!best) return;
    rows.push({
      matchId: m.id,
      market,
      selection,
      odds: best.odds,
      bookmaker: best.bookmaker,
      prices: [...list].sort((x, y) => y.odds - x.odds),
      impliedProb: 1 / best.odds,
      modelProb: prob,
      ev: prob * best.odds - 1,
      confidence: confidence(prob, hs, as),
    });
  };
  // Placeholder model = market-anchored baseline: blend the de-vigged market with the goals baseline.
  // The market is the consensus across bookmakers (mean implied probability per selection, then normalised).
  // Strengths are relative to each team's own league, so they are not comparable across leagues: cross-league games
  // (Champions League) and teams without a domestic table get the market alone, so no fake value appears.
  const sameLeague = hs && as && data.table.find((t) => t.id === m.home.id)?.competitionId === data.table.find((t) => t.id === m.away.id)?.competitionId;
  const baselineWeight = sameLeague ? BASELINE_WEIGHT : 0;
  const blend = (lists: BookPrice[][], base: number[]) => {
    if (lists.some((l) => !l.length)) return null;
    const inv = lists.map((l) => l.reduce((s, x) => s + 1 / x.odds, 0) / l.length);
    const total = inv.reduce((s, x) => s + x, 0);
    return inv.map((x, i) => (1 - baselineWeight) * (x / total) + baselineWeight * base[i]);
  };
  const result = blend([prices.home, prices.draw, prices.away], [p.home, p.draw, p.away]);
  const goals = blend([prices.over25, prices.under25], [p.over25, 1 - p.over25]);
  if (result) {
    add("1X2", "Home", prices.home, result[0]);
    add("1X2", "Draw", prices.draw, result[1]);
    add("1X2", "Away", prices.away, result[2]);
  }
  if (goals) {
    add("OU_2.5", "Over 2.5", prices.over25, goals[0]);
    add("OU_2.5", "Under 2.5", prices.under25, goals[1]);
  }

  const best = rows.reduce<BetPrediction | undefined>((x, y) => (!x || y.ev > x.ev ? y : x), undefined);
  if (best && best.ev > 0 && sameLeague && hs && as && best.selection !== "Draw")
    best.topFactors = factorsFor(best.selection as "Home" | "Away" | "Over 2.5" | "Under 2.5", hs, as);
  return { rows, probs: p, h2h, hs, as };
}

/**
 * Other sports: match-winner odds only (market id "1X2", so labels, filters and the tracker work unchanged).
 * There is no stats model yet, so the model is the de-vigged consensus of the bookmakers: a pick is "value" when one
 * book's price beats that consensus fair price.
 */
async function sportPredictionsFor(m: Match): Promise<BetPrediction[]> {
  const prices = await winnerPricesFor(m);
  if (!prices?.home.length || !prices.away.length) return [];
  const sides = (
    [
      ["Home", prices.home],
      ["Draw", prices.draw],
      ["Away", prices.away],
    ] as const
  ).filter(([, list]) => list.length);
  const inv = sides.map(([, list]) => list.reduce((s, x) => s + 1 / x.odds, 0) / list.length);
  const total = inv.reduce((s, x) => s + x, 0);
  return sides.map(([selection, list], i) => {
    const prob = inv[i] / total;
    const best = list.reduce((x, y) => (y.odds > x.odds ? y : x));
    return {
      matchId: m.id,
      market: "1X2",
      selection,
      odds: best.odds,
      bookmaker: best.bookmaker,
      prices: [...list].sort((x, y) => y.odds - x.odds),
      impliedProb: 1 / best.odds,
      modelProb: prob,
      ev: prob * best.odds - 1,
      // Market-only model: a single book disagreeing is weak evidence, so never "high". With one book (ESPN's
      // DraftKings line) the model is that book's own fair price, so EV is just minus its margin: no value picks.
      confidence: list.length >= 3 && prob >= 0.35 ? "medium" : "low",
    };
  });
}

async function upcomingPredictions(sport: SportId = DEFAULT_SPORT) {
  if (sport !== "football") {
    const now = Date.now();
    const upcoming = (await getMatches(sport)).filter(
      (m) => m.status === "scheduled" && new Date(m.kickoff).getTime() > now && new Date(m.kickoff).getTime() < now + UPCOMING_DAYS * DAY,
    );
    const rows = await mapLimit(upcoming, 8, sportPredictionsFor);
    return upcoming.map((match, i) => ({ match, rows: rows[i] }));
  }
  const data = await load();
  const upcoming = data.matches.filter((m) => isUpcoming(m));
  const results = await mapLimit(upcoming, 6, (m) => predictionsFor(m, data));
  return upcoming.map((m, i) => ({ match: toMatch(m), rows: results[i].rows }));
}

// ---------------------------------------------------------------------------------------------------------------
// Public API

export async function getLeagues(): Promise<League[]> {
  return COMPETITIONS.map(({ id, name, country, logoUrl }) => ({ id, name, country, logoUrl }));
}

/** Bookmakers with a feed for this sport, for the odds panel's book switcher. */
export async function getBookmakers(sport: SportId = DEFAULT_SPORT): Promise<Bookmaker[]> {
  if (sport !== "football") {
    const draftkings = { id: "draftkings", name: "DraftKings", short: "DK", live: true };
    return [...(otherSportsOddsApi() ? oddsApiBookmakers() : []), ...(ESPN_ODDS_SPORTS.includes(sport) ? [draftkings] : [])];
  }
  if (footballOddsApi()) return oddsApiBookmakers();
  // Without ODDS_API_KEY only DraftKings has a feed; the usual books are shown as not connected.
  return [
    { id: "draftkings", name: "DraftKings", short: "DK", live: true },
    ...[
      ["bet365", "Bet365", "B3"],
      ["pinnacle", "Pinnacle", "PN"],
      ["betfair", "Betfair", "BF"],
      ["1xbet", "1xBet", "1X"],
      ["williamhill", "William Hill", "WH"],
      ["stake", "Stake", "ST"],
      ["bcgame", "BC.Game", "BC"],
    ].map(([id, name, short]) => ({ id, name, short, live: false })),
  ];
}

export async function getTeams(): Promise<TeamProfile[]> {
  const table = await fetchStandings();
  const order = COMPETITIONS.map((c) => c.id);
  return [...table]
    .sort((a, b) => order.indexOf(a.competitionId) - order.indexOf(b.competitionId) || a.rank - b.rank)
    .map((t) => ({ id: t.id, name: t.name, crestUrl: t.crestUrl, leagueId: t.competitionId, form: [] }));
}

/** Every match from last month to next month: results, live games and fixtures. */
export async function getMatches(sport: SportId = DEFAULT_SPORT): Promise<Match[]> {
  // Other sports: only what the list can show (results from the last week onward). Tennis draws are large, and
  // shipping a month of old results makes the page several MB. Unknown pairings (TBD v TBD) are left out.
  if (sport !== "football") {
    const since = Date.now() - 8 * DAY;
    return (await fetchSportMatches(sport)).filter(
      (m) => new Date(m.kickoff).getTime() >= since && !(m.home.name === "TBD" && m.away.name === "TBD"),
    );
  }
  return (await fetchMatches()).map(toMatch);
}

/** Leagues for the sidebar. Football's are the fixed competitions; other sports come from their feed. */
export async function getSportLeagues(sport: SportId): Promise<League[]> {
  return sport === "football" ? getLeagues() : fetchSportLeagues(sport);
}

/** A non-football match, or null. */
export async function getSportMatch(id: string): Promise<Match | null> {
  const sport = sportOfMatchId(id);
  if (sport === "football") return null;
  return (await fetchSportMatches(sport)).find((m) => m.id === id) ?? null;
}

/** A non-football match with its match-winner odds and, where the feed has enough data, a stats radar. */
export async function getSportMatchDetail(id: string): Promise<{ match: Match; predictions: BetPrediction[]; radar: StatsRadar | null } | null> {
  const match = await getSportMatch(id);
  if (!match) return null;
  const [predictions, radar] = await Promise.all([
    match.status === "scheduled" ? sportPredictionsFor(match) : Promise.resolve([]),
    fetchSportRadar(match),
  ]);
  return { match, predictions: predictions.sort((a, b) => b.ev - a.ev), radar };
}

/** Value bets across upcoming matches (next 7 days), best EV first. */
export async function getTopPicks(sport: SportId = DEFAULT_SPORT): Promise<PickWithMatch[]> {
  return (await upcomingPredictions(sport))
    .flatMap(({ match, rows }) => rows.filter((r) => r.ev >= MIN_VALUE_EV).map((r) => ({ ...r, match })))
    .sort((a, b) => b.ev - a.ev);
}

/** The best-EV bet for each upcoming match, keyed by match id. */
export async function getBestPickByMatch(sport: SportId = DEFAULT_SPORT): Promise<Record<string, BetPrediction>> {
  const best: Record<string, BetPrediction> = {};
  for (const { match, rows } of await upcomingPredictions(sport))
    for (const r of rows) if (!best[match.id] || r.ev > best[match.id].ev) best[match.id] = r;
  return best;
}

/** 1X2 odds per upcoming match, keyed by match id, in Home / Draw / Away order. */
export async function getMatchOdds(sport: SportId = DEFAULT_SPORT): Promise<Record<string, BetPrediction[]>> {
  const odds: Record<string, BetPrediction[]> = {};
  for (const { match, rows } of await upcomingPredictions(sport)) odds[match.id] = rows.filter((r) => r.market === "1X2");
  return odds;
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  const data = await load();
  const m = data.matches.find((x) => x.id === id);
  if (!m) return null;
  const { rows, probs, h2h, hs, as } = await predictionsFor(m, data);

  const formPoints = (f: FormResult[]) =>
    f.length ? f.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0) / (3 * f.length) : 0.5;
  const h2hShare = (teamId: string) => {
    if (!h2h.length) return 0.5;
    const pts = h2h.reduce((s, g) => {
      const [gf, ga] = g.homeId === teamId ? [g.homeGoals, g.awayGoals] : [g.awayGoals, g.homeGoals];
      return s + (gf > ga ? 3 : gf === ga ? 1 : 0);
    }, 0);
    return pts / (3 * h2h.length);
  };
  const clamp = (x: number) => Math.max(5, Math.min(100, Math.round(x)));
  const homeForm = parseForm(m.home.form);
  const awayForm = parseForm(m.away.form);
  const radar = (st: Strength | undefined, form: FormResult[], teamId: string): RadarRatings => ({
    attack: clamp(50 * (st?.attack ?? 1)),
    defence: clamp(50 / (st?.defence ?? 1)),
    form: clamp(100 * formPoints(form)),
    ppg: clamp(st && st.played ? (100 * st.points) / (3 * st.played) : 50),
    h2h: clamp(100 * h2hShare(teamId)),
  });
  const describe = (r: RadarRatings) => {
    const label: Record<keyof RadarRatings, string> = {
      attack: "Attack",
      defence: "Defence",
      form: "Form",
      ppg: "Points per game",
      h2h: "Head-to-head",
    };
    const level = (v: number) => (v >= 80 ? "very strong" : v >= 62 ? "strong" : v <= 35 ? "very weak" : "weak");
    const sorted = (Object.entries(r) as [keyof RadarRatings, number][]).sort((x, y) => y[1] - x[1]);
    return {
      strengths: sorted.slice(0, 2).filter(([, v]) => v >= 62).map(([k, v]) => `${label[k]}: ${level(v)}`),
      weaknesses: sorted.slice(-2).filter(([, v]) => v < 45).map(([k, v]) => `${label[k]}: ${level(v)}`),
    };
  };
  const radarHome = radar(hs, homeForm, m.home.id);
  const radarAway = radar(as, awayForm, m.away.id);
  const insights: MatchInsights = {
    expectedGoals: { home: probs.xgHome, away: probs.xgAway },
    radar: { home: radarHome, away: radarAway },
    characteristics: { home: describe(radarHome), away: describe(radarAway) },
    h2h,
  };
  return { match: toMatch(m), predictions: [...rows].sort((a, b) => b.ev - a.ev), insights, homeForm, awayForm };
}

// ---------------------------------------------------------------------------------------------------------------
// Sample history (Performance page). Dates are shifted so the sample always covers the last few months.

const SAMPLE_ANCHOR = Date.UTC(2026, 9, 11);

function sample() {
  const now = new Date();
  const shift = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - SAMPLE_ANCHOR) / DAY) * DAY;
  const shiftIso = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
  return {
    past: (pastJson as PastPrediction[]).map((p) => ({ ...p, settledAt: shiftIso(p.settledAt) })),
    shiftDate: (date: string) => shiftIso(`${date}T00:00:00Z`).slice(0, 10),
  };
}

export async function getPastPredictions(): Promise<PastPrediction[]> {
  return [...sample().past].sort((a, b) => b.settledAt.localeCompare(a.settledAt));
}

export async function getModelGlance(): Promise<ModelGlance> {
  const top = await getTopPicks();
  const localDay = (d: Date) => d.toDateString();
  const today = top.filter((p) => localDay(new Date(p.match.kickoff)) === localDay(new Date()));
  const since = Date.now() - 30 * DAY;
  const recent = sample()
    .past.filter((p) => new Date(p.settledAt).getTime() >= since && p.result !== "void")
    .sort((a, b) => a.settledAt.localeCompare(b.settledAt));
  let running = 0;
  const series = recent.map((p) => (running += p.profit));
  return {
    picksToday: today.length,
    avgEv: today.length ? today.reduce((s, p) => s + p.ev, 0) / today.length : 0,
    roi30d: recent.length ? running / recent.length : 0,
    roi30dPicks: recent.length,
    roi30dSeries: series,
  };
}

export async function getCalibration(): Promise<CalibrationBin[]> {
  return modelJson.calibration;
}

export async function getRetrains(): Promise<Retrain[]> {
  const { shiftDate } = sample();
  return modelJson.retrains.map((r) => ({ ...r, date: shiftDate(r.date) }));
}
