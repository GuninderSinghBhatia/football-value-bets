// Generates the mock data in src/mocks. Run with `npm run mocks`.
//
// Every market for a match is derived from one Poisson goal model (expected goals from team ratings),
// so 1X2, double chance, over/under and BTTS prices agree with each other. Bookmakers add their own
// margin and a little noise; the "model" disagrees with the market slightly, which is where value comes from.
// All numbers are fake. They exist so the UI has realistic, internally consistent data until the backend exists.
import fs from "node:fs";

const OUT = new URL("../src/mocks/", import.meta.url);
const ANCHOR = Date.UTC(2026, 9, 11); // api.ts shifts all dates relative to this day
const DAY = 86_400_000;

/** Small seeded PRNG so the output is reproducible. */
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const crest = (id) => (id ? `https://crests.football-data.org/${id}.png` : "");

// ---------------------------------------------------------------------------------------------------------------
// Leagues and teams. rating is roughly -1 (weak) .. +1 (elite); crest ids are football-data.org team ids.

const LEAGUES = [
  { id: "PD", name: "LaLiga", country: "Spain", goals: [1.42, 1.1], cards: 5.1, corners: 9.6, matchday: 9 },
  { id: "PL", name: "Premier League", country: "England", goals: [1.55, 1.25], cards: 3.9, corners: 10.3, matchday: 8 },
  { id: "SA", name: "Serie A", country: "Italy", goals: [1.4, 1.12], cards: 4.7, corners: 9.4, matchday: 7 },
  { id: "BL1", name: "Bundesliga", country: "Germany", goals: [1.7, 1.38], cards: 4.1, corners: 9.5, matchday: 6 },
  { id: "FL1", name: "Ligue 1", country: "France", goals: [1.45, 1.15], cards: 4.4, corners: 9.2, matchday: 8 },
  // Cup competition: no teams of its own, fixtures pair clubs from the leagues above.
  { id: "CL", name: "Champions League", country: "Europe", goals: [1.5, 1.2], cards: 4.0, corners: 9.8, matchday: 3 },
].map((l) => ({ ...l, logoUrl: `https://crests.football-data.org/${l.id}.png` }));

const TEAMS = {
  PD: [
    ["rma", "Real Madrid", 86, 0.95], ["bar", "Barcelona", 81, 0.9], ["atm", "Atlético Madrid", 78, 0.65],
    ["vil", "Villarreal", 94, 0.4], ["bet", "Real Betis", 90, 0.3], ["ath", "Athletic Club", 77, 0.35],
    ["rso", "Real Sociedad", 92, 0.25], ["sev", "Sevilla", 559, 0.05], ["val", "Valencia", 95, -0.05],
    ["cel", "Celta Vigo", 558, 0.05], ["osa", "Osasuna", 79, -0.05], ["get", "Getafe", 82, -0.3],
    ["mll", "Mallorca", 89, -0.2], ["ray", "Rayo Vallecano", 87, -0.1], ["esp", "Espanyol", 80, -0.35],
    ["ala", "Alavés", 263, -0.3], ["gir", "Girona", 298, 0.1], ["elc", "Elche", 285, -0.45],
    ["lev", "Levante", 88, -0.45], ["ovi", "Real Oviedo", null, -0.6],
  ],
  PL: [
    ["liv", "Liverpool", 64, 0.9], ["ars", "Arsenal", 57, 0.9], ["mci", "Manchester City", 65, 0.85],
    ["che", "Chelsea", 61, 0.6], ["new", "Newcastle United", 67, 0.45], ["avl", "Aston Villa", 58, 0.4],
    ["tot", "Tottenham Hotspur", 73, 0.35], ["mun", "Manchester United", 66, 0.25], ["bha", "Brighton", 397, 0.2],
    ["whu", "West Ham United", 563, -0.1],
  ],
  SA: [
    ["int", "Inter", 108, 0.85], ["nap", "Napoli", 113, 0.75], ["juv", "Juventus", 109, 0.6], ["mil", "AC Milan", 98, 0.55],
    ["ata", "Atalanta", 102, 0.55], ["rom", "Roma", 100, 0.4], ["laz", "Lazio", 110, 0.35], ["bol", "Bologna", 103, 0.3],
    ["fio", "Fiorentina", 99, 0.25], ["tor", "Torino", 586, 0.0],
  ],
  BL1: [
    ["fcb", "Bayern Munich", 5, 1.0], ["b04", "Bayer Leverkusen", 3, 0.7], ["bvb", "Borussia Dortmund", 4, 0.6],
    ["rbl", "RB Leipzig", 721, 0.55], ["vfb", "VfB Stuttgart", 10, 0.45], ["sge", "Eintracht Frankfurt", 19, 0.4],
    ["scf", "SC Freiburg", 17, 0.2], ["wob", "VfL Wolfsburg", 11, 0.05], ["bmg", "Borussia Mönchengladbach", 18, 0.0],
    ["tsg", "Hoffenheim", 2, 0.0],
  ],
  FL1: [
    ["psg", "Paris Saint-Germain", 524, 1.0], ["om", "Marseille", 516, 0.55], ["asm", "Monaco", 548, 0.5],
    ["losc", "Lille", 521, 0.45], ["ol", "Lyon", 523, 0.4], ["ogcn", "Nice", 522, 0.3], ["rcl", "Lens", 546, 0.3],
    ["srfc", "Rennes", 529, 0.2], ["rcsa", "Strasbourg", 576, 0.15], ["fcn", "Nantes", 543, -0.2],
  ],
};

// [leagueId, home, away, dayOffset, "HH:MM" UTC]
const FIXTURES = [
  ["PD", "cel", "osa", 0, "17:00"], ["PD", "rma", "vil", 0, "19:00"], ["PD", "bar", "gir", 0, "20:00"],
  ["PD", "atm", "bet", 1, "12:00"], ["PD", "ath", "rso", 1, "14:15"], ["PD", "sev", "val", 1, "16:30"],
  ["PD", "get", "mll", 1, "19:00"], ["PD", "ray", "esp", 2, "17:00"], ["PD", "ala", "elc", 2, "19:00"],
  ["PD", "lev", "ovi", 4, "19:00"],
  ["PL", "ars", "new", 0, "15:30"], ["PL", "mci", "avl", 0, "13:00"], ["PL", "liv", "mun", 1, "15:30"],
  ["PL", "che", "bha", 1, "13:00"], ["PL", "tot", "whu", 2, "19:00"],
  ["SA", "int", "rom", 0, "18:45"], ["SA", "nap", "juv", 1, "18:45"], ["SA", "mil", "ata", 1, "16:00"],
  ["SA", "laz", "bol", 2, "18:45"], ["SA", "fio", "tor", 3, "16:30"],
  ["BL1", "fcb", "bvb", 0, "16:30"], ["BL1", "b04", "rbl", 1, "13:30"], ["BL1", "vfb", "sge", 1, "15:30"],
  ["BL1", "scf", "wob", 2, "13:30"], ["BL1", "bmg", "tsg", 3, "17:30"],
  ["FL1", "psg", "om", 0, "19:45"], ["FL1", "asm", "losc", 1, "15:00"], ["FL1", "ol", "ogcn", 1, "19:45"],
  ["FL1", "rcl", "srfc", 2, "13:00"], ["FL1", "rcsa", "fcn", 3, "15:00"],
  ["CL", "bvb", "nap", 2, "16:45"], ["CL", "rma", "liv", 2, "19:00"], ["CL", "bar", "psg", 2, "19:00"],
  ["CL", "mci", "b04", 3, "16:45"], ["CL", "int", "fcb", 3, "19:00"], ["CL", "ars", "atm", 3, "19:00"],
];

const BOOKS = [
  // margin = overround applied to fair probabilities; markets = what the book offers in this mock
  { id: "bet365", name: "Bet365", short: "B3", margin: 1.055, markets: ["1X2", "DC", "OU_2.5", "BTTS", "CARDS_4.5", "CORNERS_9.5"] },
  { id: "pinnacle", name: "Pinnacle", short: "PN", margin: 1.025, markets: ["1X2", "DC", "OU_2.5"] },
  { id: "betfair", name: "Betfair", short: "BF", margin: 1.03, markets: ["1X2", "OU_2.5", "BTTS"] },
  { id: "1xbet", name: "1xBet", short: "1X", margin: 1.045, markets: ["1X2", "DC", "OU_2.5", "BTTS", "CARDS_4.5", "CORNERS_9.5"] },
  { id: "williamhill", name: "William Hill", short: "WH", margin: 1.065, markets: ["1X2", "DC", "OU_2.5", "BTTS", "CARDS_4.5"] },
  { id: "stake", name: "Stake", short: "ST", margin: 1.04, markets: ["1X2", "DC", "OU_2.5", "BTTS", "CARDS_4.5", "CORNERS_9.5"] },
  { id: "bcgame", name: "BC.Game", short: "BC", margin: 1.06, markets: ["1X2", "DC", "OU_2.5", "BTTS", "CORNERS_9.5"] },
];

// ---------------------------------------------------------------------------------------------------------------
// Probability helpers

const fact = [1];
for (let i = 1; i <= 25; i++) fact[i] = fact[i - 1] * i;
const poisson = (k, l) => (Math.exp(-l) * l ** k) / fact[k];
const poissonCdf = (k, l) => Array.from({ length: k + 1 }, (_, i) => poisson(i, l)).reduce((a, b) => a + b, 0);
const samplePoisson = (l) => {
  let k = 0;
  let p = Math.exp(-l);
  let s = p;
  const u = rand();
  while (u > s && k < 15) {
    p *= l / ++k;
    s += p;
  }
  return k;
};

/** Match outcome probabilities from a scoreline matrix of independent Poisson goals. */
function goalMarkets(lh, la) {
  let home = 0, draw = 0, away = 0, over = 0, btts = 0;
  for (let h = 0; h <= 10; h++)
    for (let a = 0; a <= 10; a++) {
      const p = poisson(h, lh) * poisson(a, la);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h + a > 2.5) over += p;
      if (h > 0 && a > 0) btts += p;
    }
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total, over, btts };
}

const normalize = (ps) => {
  const s = ps.reduce((a, b) => a + b, 0);
  return ps.map((p) => p / s);
};
/** The model's view: the fair probabilities with some independent disagreement. */
const modelView = (ps, noise = 0.05) => normalize(ps.map((p) => p * Math.exp(normal() * noise)));
const confidence = (p) => (p >= 0.55 ? "high" : p >= 0.35 ? "medium" : "low");

/** A book's price: fair probability, plus a little book-specific noise, with the book's margin. Floored to 0.01. */
function bookOdds(fair, margin) {
  const noisy = normalize(fair.map((p) => p * Math.exp(normal() * 0.025)));
  return noisy.map((p) => Math.max(1.01, Math.floor((100 / (p * margin))) / 100));
}

// ---------------------------------------------------------------------------------------------------------------
// Build

const teams = [];
const teamById = {};
for (const [leagueId, list] of Object.entries(TEAMS))
  for (const [id, name, fd, rating] of list) {
    const pWin = 0.2 + 0.32 * (rating + 1) * 0.75;
    const form = Array.from({ length: 5 }, () => {
      const x = rand();
      return x < pWin ? "W" : x < pWin + 0.27 ? "D" : "L";
    });
    const t = { id, name, crestUrl: crest(fd), leagueId, form, rating };
    teams.push(t);
    teamById[id] = t;
  }
const teamRef = (id) => ({ id, name: teamById[id].name, crestUrl: teamById[id].crestUrl });
const leagueById = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));

const expectedGoals = (league, h, a) => {
  const [bh, ba] = league.goals;
  const att = (r) => Math.exp(0.38 * r);
  const def = (r) => Math.exp(-0.32 * r);
  return [bh * att(teamById[h].rating) * def(teamById[a].rating), ba * att(teamById[a].rating) * def(teamById[h].rating)];
};

const FACTORS = {
  result: ["Elo difference", "Home form last 10", "Away form last 10", "xG difference last 5", "Rest days diff", "Home advantage", "Market prior", "Injuries (key players)"],
  goals: ["xG for last 5 (home)", "xG for last 5 (away)", "xG against last 5 (home)", "xG against last 5 (away)", "Shots on target per game", "Market prior", "H2H goals avg"],
  cards: ["Referee cards per game", "Fouls per game (both teams)", "Derby / rivalry", "Cards per game (home)", "Cards per game (away)", "Match importance"],
  corners: ["Crosses per game", "Corners per game (home)", "Corners per game (away)", "Shots per game", "Possession difference"],
};
const factorGroup = (market) =>
  market === "CARDS_4.5" ? "cards" : market === "CORNERS_9.5" ? "corners" : market === "1X2" || market === "DC" ? "result" : "goals";

const matches = [];
const predictions = [];
const insights = {};

for (const [leagueId, h, a, day, time] of FIXTURES) {
  const league = leagueById[leagueId];
  const [hh, mm] = time.split(":").map(Number);
  const id = `${leagueId.toLowerCase()}-2026-md${league.matchday}-${h}-${a}`;
  matches.push({
    id, league: league.name, leagueId, leagueLogo: league.logoUrl, matchday: league.matchday,
    kickoff: new Date(ANCHOR + day * DAY + (hh * 60 + mm) * 60_000).toISOString(),
    home: teamRef(h), away: teamRef(a),
  });

  // Fair probabilities for every market, all from the same expected goals.
  const [lh, la] = expectedGoals(league, h, a);
  const g = goalMarkets(lh, la);
  const cardsLambda = league.cards * Math.exp(normal() * 0.12);
  const cornersLambda = league.corners * Math.exp(normal() * 0.1);
  const pCardsOver = 1 - poissonCdf(4, cardsLambda);
  const pCornersOver = 1 - poissonCdf(9, cornersLambda);

  const fair = {
    "1X2": [g.home, g.draw, g.away],
    "OU_2.5": [g.over, 1 - g.over],
    BTTS: [g.btts, 1 - g.btts],
    "CARDS_4.5": [pCardsOver, 1 - pCardsOver],
    "CORNERS_9.5": [pCornersOver, 1 - pCornersOver],
  };
  const model = Object.fromEntries(Object.entries(fair).map(([m, ps]) => [m, modelView(ps)]));
  // Double chance is fully determined by 1X2, for the market and for the model.
  const dc = ([ph, pd, pa]) => [ph + pd, pd + pa, ph + pa];
  fair.DC = dc(fair["1X2"]);
  model.DC = dc(model["1X2"]);

  const SELECTIONS = {
    "1X2": ["Home", "Draw", "Away"],
    DC: ["Home or Draw", "Draw or Away", "Home or Away"],
    "OU_2.5": ["Over 2.5", "Under 2.5"],
    BTTS: ["Yes", "No"],
    "CARDS_4.5": ["Over 4.5", "Under 4.5"],
    "CORNERS_9.5": ["Over 9.5", "Under 9.5"],
  };

  // Price every market at every book that offers it.
  const pricesByMarket = {};
  for (const market of Object.keys(SELECTIONS)) {
    pricesByMarket[market] = SELECTIONS[market].map(() => []);
    for (const b of BOOKS.filter((x) => x.markets.includes(market))) {
      // DC selections overlap, so each is priced on its own (prob vs. its complement).
      const odds =
        market === "DC"
          ? fair.DC.map((p) => bookOdds([p, 1 - p], b.margin + 0.01)[0])
          : bookOdds(fair[market], b.margin);
      odds.forEach((o, i) => pricesByMarket[market][i].push({ bookmaker: b.id, odds: o }));
    }
  }

  const rows = [];
  for (const [market, sels] of Object.entries(SELECTIONS))
    sels.forEach((selection, i) => {
      const prices = pricesByMarket[market][i];
      const top = prices.reduce((x, y) => (y.odds > x.odds ? y : x));
      const p = model[market][i];
      rows.push({
        matchId: id, market, selection, odds: top.odds, bookmaker: top.bookmaker, prices,
        impliedProb: r3(1 / top.odds), modelProb: r3(p), ev: r3(p * top.odds - 1), confidence: confidence(p),
      });
    });

  // Explain the best bet with factors relevant to its market, strongest first, led by a positive one.
  const best = rows.reduce((x, y) => (y.ev > x.ev ? y : x));
  const pool = [...FACTORS[factorGroup(best.market)]].sort(() => rand() - 0.5).slice(0, 5);
  best.topFactors = pool.map((feature, i) => ({
    feature,
    impact: r3((0.34 - i * 0.06 + rand() * 0.03) * (i === 0 || rand() < 0.75 ? 1 : -1)),
  }));
  predictions.push(...rows);

  // Insights: radar ratings follow the team ratings and form; H2H is simulated from the same goal model.
  const formScore = (t) => teamById[t].form.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0) / 15;
  const clamp = (x) => Math.max(20, Math.min(98, Math.round(x)));
  const h2h = Array.from({ length: 5 }, (_, i) => {
    const swap = i % 2 === 1;
    const [eh, ea] = swap ? expectedGoals(league, a, h) : [lh, la];
    return {
      date: new Date(ANCHOR - (175 + i * 182 + Math.floor(rand() * 20)) * DAY).toISOString().slice(0, 10),
      homeId: swap ? a : h, awayId: swap ? h : a, homeGoals: samplePoisson(eh), awayGoals: samplePoisson(ea),
    };
  });
  const h2hScore = (t) => {
    let pts = 0;
    for (const m of h2h) {
      const [gf, ga] = m.homeId === t ? [m.homeGoals, m.awayGoals] : [m.awayGoals, m.homeGoals];
      pts += gf > ga ? 3 : gf === ga ? 1 : 0;
    }
    return pts / 15;
  };
  const rating = (t, isHome) => {
    const r = teamById[t].rating;
    return {
      attack: clamp(55 + 32 * r + normal() * 6),
      defence: clamp(55 + 28 * r + normal() * 8),
      form: clamp(25 + 70 * formScore(t)),
      homeAway: clamp(50 + 25 * r + (isHome ? 8 : -6) + normal() * 6),
      h2h: clamp(25 + 70 * h2hScore(t)),
    };
  };
  const radar = { home: rating(h, true), away: rating(a, false) };
  const describe = (r) => {
    const label = { attack: "Attack", defence: "Defence", form: "Form", homeAway: "Home/away record", h2h: "Head-to-head" };
    const level = (v) => (v >= 80 ? "very strong" : v >= 65 ? "strong" : v <= 40 ? "very weak" : "weak");
    const sorted = Object.entries(r).sort((x, y) => y[1] - x[1]);
    return {
      strengths: sorted.slice(0, 2).filter(([, v]) => v >= 65).map(([k, v]) => `${label[k]}: ${level(v)}`),
      weaknesses: sorted.slice(-2).filter(([, v]) => v < 55).map(([k, v]) => `${label[k]}: ${level(v)}`),
    };
  };
  insights[id] = {
    expectedGoals: { home: r2(lh), away: r2(la) },
    radar,
    characteristics: { home: describe(radar.home), away: describe(radar.away) },
    h2h,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Settled history: value bets from the last ~120 days, flat 1-unit stakes.
// Outcomes are drawn from the market's fair probability with a small real edge, so ROI lands near a realistic +1–4%.

const past = [];
// Own random stream, so changing the matches above does not reshuffle the history.
const pastRand = rng(Number(process.env.PAST_SEED ?? 15));
const pastPick = (arr) => arr[Math.floor(pastRand() * arr.length)];
const PAST_MARKETS = [
  ["1X2", ["Home", "Draw", "Away"]], ["OU_2.5", ["Over 2.5", "Under 2.5"]], ["BTTS", ["Yes", "No"]],
  ["DC", ["Home or Draw", "Draw or Away"]], ["CARDS_4.5", ["Over 4.5", "Under 4.5"]], ["CORNERS_9.5", ["Over 9.5", "Under 9.5"]],
];
const leagueTeams = Object.fromEntries(Object.keys(TEAMS).map((l) => [l, teams.filter((t) => t.leagueId === l)]));
leagueTeams.CL = teams.filter((t) => t.form.filter((r) => r === "W").length >= 3); // stand-in for European clubs
const N_PAST = 180;
for (let i = 0; i < N_PAST; i++) {
  const league = pastPick(LEAGUES);
  const [h, a] = [...leagueTeams[league.id]].sort(() => pastRand() - 0.5);
  const [market, sels] = pastPick(PAST_MARKETS);
  const selection = pastPick(sels);
  const odds = r2(market === "DC" ? 1.3 + pastRand() * 0.55 : selection === "Draw" ? 3 + pastRand() * 0.9 : 1.55 + pastRand() * 1.5);
  const implied = 1 / odds;
  const modelProb = Math.min(0.92, implied * (1.03 + pastRand() * 0.08));
  const trueProb = implied * 1.025; // the model has a small genuine edge
  const result = pastRand() < 0.015 ? "void" : pastRand() < trueProb ? "won" : "lost";
  const daysAgo = 1 + Math.floor(((N_PAST - i) / N_PAST) * 120);
  past.push({
    matchId: `${league.id.toLowerCase()}-past-${i}`,
    match: { home: teamRef(h.id), away: teamRef(a.id), league: league.name, leagueId: league.id },
    market, selection, odds, impliedProb: r3(implied), modelProb: r3(modelProb), ev: r3(modelProb * odds - 1),
    confidence: confidence(modelProb), result, profit: result === "won" ? r2(odds - 1) : result === "lost" ? -1 : 0,
    settledAt: new Date(ANCHOR - daysAgo * DAY + (18 + Math.floor(pastRand() * 4)) * 3_600_000).toISOString(),
  });
}

// Calibration from a large simulated sample of model predictions (slightly overconfident at the extremes).
const bins = Array.from({ length: 9 }, (_, i) => ({ lo: 0.1 + i * 0.09, sumP: 0, hits: 0, count: 0 }));
for (let i = 0; i < 6000; i++) {
  const p = 0.1 + rand() * 0.8;
  const truth = 0.5 + (p - 0.5) * 0.93;
  const bin = bins[Math.min(8, Math.floor((p - 0.1) / 0.09))];
  bin.sumP += p;
  bin.count++;
  if (rand() < truth) bin.hits++;
}
const calibration = bins.map((b) => ({ predicted: r3(b.sumP / b.count), actual: r3(b.hits / b.count), count: b.count }));

const model = {
  calibration,
  retrains: [
    { version: "v4", date: "2026-10-06", note: "Weekly retrain with the latest matchweek results", logLoss: 0.985 },
    { version: "v3", date: "2026-09-08", note: "Added xG features, recalibrated (isotonic)", logLoss: 0.987 },
    { version: "v2", date: "2026-07-28", note: "Dixon-Coles time decay tuned", logLoss: 0.992 },
    { version: "v1", date: "2026-06-13", note: "First Poisson model", logLoss: 0.998 },
  ],
};

// ---------------------------------------------------------------------------------------------------------------

const write = (name, data) => fs.writeFileSync(new URL(name, OUT), JSON.stringify(data, null, 2) + "\n");
fs.mkdirSync(OUT, { recursive: true });
write("leagues.json", LEAGUES.map(({ id, name, country, logoUrl }) => ({ id, name, country, logoUrl })));
write("bookmakers.json", BOOKS.map(({ id, name, short }) => ({ id, name, short })));
write("teams.json", teams.map(({ id, name, crestUrl, leagueId, form }) => ({ id, name, crestUrl, leagueId, form })));
write("matches.json", matches);
write("predictions.json", predictions);
write("insights.json", insights);
write("past-predictions.json", past);
write("model.json", model);

const settled = past.filter((p) => p.result !== "void");
const roi = settled.reduce((s, p) => s + p.profit, 0) / settled.length;
console.log(
  `${matches.length} matches, ${predictions.length} predictions, ${predictions.filter((p) => p.ev >= 0.02).length} value bets ` +
    `(max EV ${(Math.max(...predictions.map((p) => p.ev)) * 100).toFixed(1)}%), ${past.length} settled picks, ROI ${(roi * 100).toFixed(1)}%`,
);
