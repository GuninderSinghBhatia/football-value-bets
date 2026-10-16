import { Suspense } from "react";
import { TopPicksView } from "@/components/home/top-picks-view";
import { ModelGlance } from "@/components/home/model-glance";
import { PageColumns } from "@/components/shell/page-columns";
import { SportComingSoon } from "@/components/shell/sport-coming-soon";
import { SportSwitcher } from "@/components/shell/sport-switcher";
import { Skeleton } from "@/components/ui/primitives";
import { parseSport } from "@/config/sports";
import { getLeagues, getMatchDetail, getMatchOdds, getModelGlance, getSportLeagues, getTopPicks } from "@/lib/api";
import { otherSportsOddsApi } from "@/lib/odds-api";
import { otherSportsNote } from "@/lib/sources";
import type { MatchInsights } from "@/lib/types";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const sport = parseSport((await searchParams).sport);

  // Other sports: match-winner value picks, with an odds comparison chart instead of the football radar.
  if (sport !== "football") {
    const [picks, leagues, oddsByMatch] = await Promise.all([getTopPicks(sport), getSportLeagues(sport), getMatchOdds(sport)]);
    return (
      <PageColumns right={<SportComingSoon sport={sport} />}>
        <SportSwitcher />
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <TopPicksView
            picks={picks}
            leagues={leagues}
            radars={{}}
            oddsByMatch={oddsByMatch}
            winnerOnly
            note={otherSportsNote(otherSportsOddsApi())}
          />
        </Suspense>
      </PageColumns>
    );
  }

  const [picks, leagues, glance] = await Promise.all([getTopPicks(), getLeagues(), getModelGlance()]);

  const radars: Record<string, MatchInsights["radar"]> = {};
  for (const id of new Set(picks.map((p) => p.matchId))) {
    const detail = await getMatchDetail(id);
    if (detail) radars[id] = detail.insights.radar;
  }

  return (
    <PageColumns right={<ModelGlance glance={glance} />}>
      <SportSwitcher />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <TopPicksView picks={picks} leagues={leagues} radars={radars} />
      </Suspense>
    </PageColumns>
  );
}
