import { Suspense } from "react";
import { FavouriteUpcoming } from "@/components/matches/favourite-upcoming";
import { MatchesView } from "@/components/matches/matches-view";
import { PageColumns } from "@/components/shell/page-columns";
import { Skeleton } from "@/components/ui/primitives";
import { getBestPickByMatch, getMatchOdds, getMatches } from "@/lib/api";

export const metadata = { title: "Matches · BetMind" };

export default async function MatchesPage() {
  const [matches, odds, best] = await Promise.all([getMatches(), getMatchOdds(), getBestPickByMatch()]);

  return (
    <PageColumns right={<FavouriteUpcoming matches={matches} />}>
      <h1 className="sr-only">Matches</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <MatchesView matches={matches} odds={odds} best={best} />
      </Suspense>
    </PageColumns>
  );
}
