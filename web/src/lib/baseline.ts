// PLACEHOLDER MODEL. A deliberately simple Poisson baseline from each team's league goals for/against,
// blended with the de-vigged market in api.ts, so the UI has probabilities to compare with real odds. It is not BetMind's model: the real one is
// built in Python (roadmap phases 2-5) and will replace this through the backend.
import type { TeamStanding } from "./espn";

const HOME_ADVANTAGE = 1.12;
const DEFAULT_AVG_GOALS = 1.4; // per team per game, used when a team has no domestic table

export type Strength = { attack: number; defence: number; played: number; points: number };

/** Attack/defence relative to the league average (1 = average), shrunk toward 1 early in the season. */
export function strengths(table: TeamStanding[]): { byTeam: Map<string, Strength>; avgGoals: Map<string, number> } {
  const avgGoals = new Map<string, number>();
  for (const id of new Set(table.map((t) => t.competitionId))) {
    const rows = table.filter((t) => t.competitionId === id);
    const games = rows.reduce((s, t) => s + t.played, 0);
    avgGoals.set(id, games ? rows.reduce((s, t) => s + t.goalsFor, 0) / games : DEFAULT_AVG_GOALS);
  }
  const byTeam = new Map<string, Strength>();
  for (const t of table) {
    const avg = avgGoals.get(t.competitionId) ?? DEFAULT_AVG_GOALS;
    const prior = 3; // pseudo-games at league average
    byTeam.set(t.id, {
      attack: (t.goalsFor + prior * avg) / (t.played + prior) / avg,
      defence: (t.goalsAgainst + prior * avg) / (t.played + prior) / avg,
      played: t.played,
      points: t.points,
    });
  }
  return { byTeam, avgGoals };
}

const fact = [1];
for (let i = 1; i <= 12; i++) fact[i] = fact[i - 1] * i;
const poisson = (k: number, l: number) => (Math.exp(-l) * l ** k) / fact[k];

export type BaselineProbs = { xgHome: number; xgAway: number; home: number; draw: number; away: number; over25: number };

export function predict(home: Strength | undefined, away: Strength | undefined, avg: number): BaselineProbs {
  const h = home ?? { attack: 1, defence: 1, played: 0, points: 0 };
  const a = away ?? { attack: 1, defence: 1, played: 0, points: 0 };
  const xgHome = avg * h.attack * a.defence * HOME_ADVANTAGE;
  const xgAway = (avg * a.attack * h.defence) / HOME_ADVANTAGE;
  let pH = 0, pD = 0, pA = 0, over = 0;
  for (let i = 0; i <= 10; i++)
    for (let j = 0; j <= 10; j++) {
      const p = poisson(i, xgHome) * poisson(j, xgAway);
      if (i > j) pH += p;
      else if (i === j) pD += p;
      else pA += p;
      if (i + j > 2.5) over += p;
    }
  const total = pH + pD + pA;
  return { xgHome, xgAway, home: pH / total, draw: pD / total, away: pA / total, over25: over };
}

/** How each input pushed the baseline toward a selection (log of the strength ratio; + means toward). */
export function factorsFor(selection: "Home" | "Away" | "Over 2.5" | "Under 2.5", home: Strength, away: Strength) {
  const ln = Math.log;
  const base = [
    { feature: "Home attack vs league average", impact: ln(home.attack) },
    { feature: "Away defence vs league average (goals conceded)", impact: ln(away.defence) },
    { feature: "Away attack vs league average", impact: ln(away.attack) },
    { feature: "Home defence vs league average (goals conceded)", impact: ln(home.defence) },
    { feature: "Home advantage", impact: ln(HOME_ADVANTAGE) },
  ];
  const sign: Record<typeof selection, number[]> = {
    Home: [1, 1, -1, -1, 1],
    Away: [-1, -1, 1, 1, -1],
    "Over 2.5": [1, 1, 1, 1, 0],
    "Under 2.5": [-1, -1, -1, -1, 0],
  };
  return base
    .map((f, i) => ({ feature: f.feature, impact: Math.round(f.impact * sign[selection][i] * 1000) / 1000 }))
    .filter((f) => f.impact !== 0)
    .sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact));
}
