// Tests for the settlement rules. Run with `npm run test:settle`.
import assert from "node:assert/strict";
import { clvFor, profitFor, settleSelection } from "../src/lib/settle.ts";

const cases: [string, string, number, number, string | null][] = [
  ["1X2", "Home", 2, 1, "won"],
  ["1X2", "Home", 1, 1, "lost"],
  ["1X2", "Draw", 0, 0, "won"],
  ["1X2", "Away", 0, 3, "won"],
  ["1X2", "Away", 2, 2, "lost"],
  ["OU_2.5", "Over 2.5", 2, 1, "won"],
  ["OU_2.5", "Over 2.5", 1, 1, "lost"],
  ["OU_2.5", "Under 2.5", 1, 1, "won"],
  ["OU_2.5", "Under 2.5", 3, 0, "lost"],
  ["OU_2", "Over 2", 1, 1, "void"], // whole line pushes
  ["BTTS", "Yes", 1, 1, "won"],
  ["BTTS", "Yes", 3, 0, "lost"],
  ["BTTS", "No", 0, 0, "won"],
  ["DC", "Home or Draw", 1, 1, "won"],
  ["DC", "Home or Draw", 0, 1, "lost"],
  ["DC", "Draw or Away", 0, 2, "won"],
  ["DC", "Home or Away", 2, 2, "lost"],
  ["CARDS_4.5", "Over 4.5", 1, 0, null], // needs card stats
];
for (const [market, sel, h, a, expected] of cases)
  assert.equal(settleSelection(market, sel, h, a), expected, `${market} ${sel} at ${h}-${a}`);

assert.equal(profitFor("won", 1, 1.85), 0.85);
assert.equal(profitFor("lost", 2, 3.1), -2);
assert.equal(profitFor("void", 1, 2.5), 0);
assert.ok(Math.abs(clvFor(2.1, 2.0) - 0.05) < 1e-9);

console.log(`✓ settlement rules: ${cases.length + 4} checks passed`);
