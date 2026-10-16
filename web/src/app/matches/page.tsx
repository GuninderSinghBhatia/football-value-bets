import { Suspense } from "react";
import { FavouriteUpcoming } from "@/components/matches/favourite-upcoming";
import { MatchesView } from "@/components/matches/matches-view";
import { PageColumns } from "@/components/shell/page-columns";
import { SportComingSoon } from "@/components/shell/sport-coming-soon";
import { SportSwitcher } from "@/components/shell/sport-switcher";
import { Skeleton } from "@/components/ui/primitives";
import { parseSport } from "@/config/sports";
import { getBestPickByMatch, getMatchOdds, getMatches, getSportLeagues } from "@/lib/api";

export const metadata = { title: "Matches · BetMind" };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const sport = parseSport((await searchParams).sport);

  if (sport !== "football") {
    const [matches, leagues, odds, best] = await Promise.all([
      getMatches(sport),
      getSportLeagues(sport),
      getMatchOdds(sport),
      getBestPickByMatch(sport),
    ]);
    return (
      <PageColumns right={<SportComingSoon sport={sport} />}>
        <h1 className="sr-only">Matches</h1>
        <SportSwitcher />
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <MatchesView matches={matches} odds={odds} best={best} leagues={leagues} />
        </Suspense>
      </PageColumns>
    );
  }

  const [matches, odds, best] = await Promise.all([getMatches(), getMatchOdds(), getBestPickByMatch()]);

  return (
    <PageColumns right={<FavouriteUpcoming matches={matches} />}>
      <h1 className="sr-only">Matches</h1>
      <SportSwitcher />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <MatchesView matches={matches} odds={odds} best={best} />
      </Suspense>
    </PageColumns>
  );
}
