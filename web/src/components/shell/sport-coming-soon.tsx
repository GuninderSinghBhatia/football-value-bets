import { Card } from "@/components/ui/primitives";
import { sportOf, type SportId } from "@/config/sports";
import { ESPN_ODDS_SPORTS, otherSportsOddsApi } from "@/lib/odds-api";

/** How picks work for a non-football sport, and which of its markets have odds with the current odds source. */
export function SportComingSoon({ sport }: { sport: SportId }) {
  const s = sportOf(sport);
  const oddsApi = otherSportsOddsApi();
  const hasOdds = oddsApi || ESPN_ODDS_SPORTS.includes(sport);
  return (
    <Card title={`How ${s.label} picks work`}>
      <p className="text-sm text-muted">
        {oddsApi ? (
          <>
            Fixtures and scores from ESPN; match-winner odds from 5 bookmakers on The Odds API&apos;s free plan
            (refreshed every 6 hours to save credits){ESPN_ODDS_SPORTS.includes(sport) ? ", plus DraftKings from ESPN" : ""}. There&apos;s no {s.label.toLowerCase()} model yet: the model % is the bookmakers&apos; fair (no-vig)
            consensus, so a value pick is one book pricing above that consensus.
          </>
        ) : hasOdds ? (
          <>
            Fixtures, scores and DraftKings moneyline odds from ESPN (free). With only one bookmaker there&apos;s nothing
            to compare its price against, so there are no value picks for {s.label.toLowerCase()} yet: that needs a
            second odds source or a {s.label.toLowerCase()} model.
          </>
        ) : (
          <>
            Fixtures and scores from ESPN. ESPN&apos;s free feed has no odds for {s.label.toLowerCase()}, so there are no
            odds or picks while BetMind uses free odds only.
          </>
        )}
      </p>
      <div className="mt-4 mb-2 text-xs text-muted">Markets</div>
      <ul className="space-y-1.5">
        {s.markets.map((m, i) => (
          <li key={m} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
            <span>{m}</span>
            {i === 0 && hasOdds ? (
              <span className="shrink-0 text-xs font-medium text-positive">{oddsApi ? "Live odds" : "DraftKings odds"}</span>
            ) : (
              <span className="shrink-0 text-xs text-muted">{i === 0 ? "No free odds" : "Coming soon"}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
