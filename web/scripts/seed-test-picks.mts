// Adds two test picks for a finished match so settlement can be checked end to end. Remove them afterwards.
import { promises as fs } from "fs";
import { fetchMatches } from "../src/lib/espn.ts";

const m = (await fetchMatches()).find((x) => x.home.name === "Real Madrid" && x.away.name === "Villarreal" && x.status === "finished");
if (!m) throw new Error("finished Real Madrid v Villarreal not found");
const file = "data/picks.json";
const picks = JSON.parse(await fs.readFile(file, "utf8").catch(() => "[]"));
const base = {
  userId: "local", matchId: m.id, bookmaker: "draftkings", modelVersion: "placeholder-baseline-v1", stake: 1,
  match: { home: { id: m.home.id, name: m.home.name, crestUrl: m.home.crestUrl }, away: { id: m.away.id, name: m.away.name, crestUrl: m.away.crestUrl }, league: m.competition.name, leagueId: m.competition.id, kickoff: m.kickoff },
  savedAt: new Date(Date.parse(m.kickoff) - 86_400_000).toISOString(), status: "pending", tags: ["e2e-test"],
};
picks.push(
  { ...base, id: "e2e-home", market: "1X2", selection: "Home", oddsAtSave: 1.7, modelProb: 0.62, impliedProb: 0.588, ev: 0.054, confidence: "high", note: "E2E test: should win" },
  { ...base, id: "e2e-over", market: "OU_2.5", selection: "Over 2.5", oddsAtSave: 1.8, modelProb: 0.6, impliedProb: 0.556, ev: 0.08, confidence: "high", note: "E2E test: should lose (1-0)" },
);
await fs.writeFile(file, JSON.stringify(picks, null, 2));
console.log(`seeded 2 test picks for ${m.id}: ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name}`);
