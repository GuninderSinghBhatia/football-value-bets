// Checks that the data in src/mocks is internally consistent. Run with `npm run check:mocks`.
// The same checks should pass for real backend data, so this doubles as the contract test for the API later.
import fs from "node:fs";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../src/mocks/${name}`, import.meta.url), "utf8"));
const leagues = read("leagues.json");
const books = read("bookmakers.json");
const teams = read("teams.json");
const matches = read("matches.json");
const predictions = read("predictions.json");
const insights = read("insights.json");
const past = read("past-predictions.json");
const model = read("model.json");

const errors = [];
const fail = (msg) => errors.push(msg);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const MARKETS = {
  "1X2": ["Home", "Draw", "Away"],
  DC: ["Home or Draw", "Draw or Away", "Home or Away"],
  "OU_2.5": ["Over 2.5", "Under 2.5"],
  BTTS: ["Yes", "No"],
  "CARDS_4.5": ["Over 4.5", "Under 4.5"],
  "CORNERS_9.5": ["Over 9.5", "Under 9.5"],
};
const leagueIds = new Set(leagues.map((l) => l.id));
const teamIds = new Set(teams.map((t) => t.id));
const bookIds = new Set(books.map((b) => b.id));

/** Shared checks for one priced prediction. Model % is rounded to 3 decimals, so EV may differ by up to 0.0005 × odds. */
function checkPrice(p, where) {
  if (p.odds < 1.01) fail(`${where}: odds ${p.odds} below 1.01`);
  if (!near(p.impliedProb, 1 / p.odds, 0.0006)) fail(`${where}: impliedProb ${p.impliedProb} ≠ 1/${p.odds}`);
  if (!near(p.ev, p.modelProb * p.odds - 1, 0.0005 * p.odds + 0.0006))
    fail(`${where}: ev ${p.ev} ≠ ${p.modelProb} × ${p.odds} − 1`);
  if (p.modelProb <= 0 || p.modelProb >= 1) fail(`${where}: modelProb ${p.modelProb} out of (0, 1)`);
}

// Matches
const matchIds = new Set();
for (const m of matches) {
  if (matchIds.has(m.id)) fail(`duplicate match ${m.id}`);
  matchIds.add(m.id);
  if (!leagueIds.has(m.leagueId)) fail(`${m.id}: unknown league ${m.leagueId}`);
  for (const t of [m.home, m.away]) if (!teamIds.has(t.id)) fail(`${m.id}: unknown team ${t.id}`);
  // Domestic matches are between teams of that league; cup competitions (CL) draw from every league.
  if (m.leagueId !== "CL")
    for (const t of [m.home, m.away])
      if (teams.find((x) => x.id === t.id)?.leagueId !== m.leagueId) fail(`${m.id}: ${t.id} is not in ${m.leagueId}`);
  if (Number.isNaN(Date.parse(m.kickoff))) fail(`${m.id}: bad kickoff ${m.kickoff}`);
}

// Predictions
for (const m of matches) {
  const rows = predictions.filter((p) => p.matchId === m.id);
  for (const [market, sels] of Object.entries(MARKETS)) {
    const list = sels.map((s) => rows.find((p) => p.market === market && p.selection === s));
    if (list.some((p) => !p)) {
      fail(`${m.id}: ${market} is missing selections`);
      continue;
    }
    for (const p of list) {
      const where = `${m.id} ${market} ${p.selection}`;
      checkPrice(p, where);
      const best = Math.max(...p.prices.map((x) => x.odds));
      if (p.odds !== best) fail(`${where}: odds ${p.odds} is not the best price ${best}`);
      if (!p.prices.some((x) => x.bookmaker === p.bookmaker && x.odds === p.odds)) fail(`${where}: bookmaker doesn't match best price`);
      for (const x of p.prices) if (!bookIds.has(x.bookmaker)) fail(`${where}: unknown bookmaker ${x.bookmaker}`);
    }
    // Model probabilities of mutually exclusive selections sum to 1.
    if (market !== "DC") {
      const sum = list.reduce((s, p) => s + p.modelProb, 0);
      if (!near(sum, 1, 0.003)) fail(`${m.id} ${market}: model probabilities sum to ${sum.toFixed(3)}`);
      // Every bookmaker builds in a margin: implied probabilities sum to more than 1.
      for (const b of books) {
        const odds = list.map((p) => p.prices.find((x) => x.bookmaker === b.id)?.odds);
        if (odds.every(Boolean)) {
          const overround = odds.reduce((s, o) => s + 1 / o, 0);
          if (overround <= 1 || overround > 1.15) fail(`${m.id} ${market} @${b.id}: overround ${overround.toFixed(3)}`);
        }
      }
    }
  }
  // Double chance must agree with the match result.
  const prob = (market, sel) => rows.find((p) => p.market === market && p.selection === sel)?.modelProb ?? NaN;
  const [h, d, a] = ["Home", "Draw", "Away"].map((s) => prob("1X2", s));
  for (const [sel, expected] of [["Home or Draw", h + d], ["Draw or Away", d + a], ["Home or Away", h + a]])
    if (!near(prob("DC", sel), expected, 0.003)) fail(`${m.id} DC ${sel}: ${prob("DC", sel)} ≠ 1X2 sum ${expected.toFixed(3)}`);

  // Insights
  const ins = insights[m.id];
  if (!ins) fail(`${m.id}: no insights`);
  else
    for (const g of ins.h2h) {
      const ids = new Set([g.homeId, g.awayId]);
      if (!ids.has(m.home.id) || !ids.has(m.away.id)) fail(`${m.id}: head-to-head game with other teams`);
    }
}
for (const p of predictions) if (!matchIds.has(p.matchId)) fail(`prediction for unknown match ${p.matchId}`);

// Settled history
for (const p of past) {
  checkPrice(p, `past ${p.matchId}`);
  const expected = p.result === "won" ? Math.round((p.odds - 1) * 100) / 100 : p.result === "lost" ? -1 : 0;
  if (!near(p.profit, expected, 0.001)) fail(`past ${p.matchId}: profit ${p.profit} ≠ ${expected} for ${p.result}`);
  if (!leagueIds.has(p.match.leagueId)) fail(`past ${p.matchId}: unknown league`);
}

// Calibration
for (const b of model.calibration)
  if (b.predicted < 0 || b.predicted > 1 || b.actual < 0 || b.actual > 1 || b.count <= 0) fail(`bad calibration bin ${JSON.stringify(b)}`);

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in mock data:`);
  for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ mock data is consistent: ${matches.length} matches, ${predictions.length} predictions, ${past.length} settled picks`);
