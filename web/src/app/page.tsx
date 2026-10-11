import { Suspense } from "react";
import { TopPicksView } from "@/components/home/top-picks-view";
import { ModelGlance } from "@/components/home/model-glance";
import { PageColumns } from "@/components/shell/page-columns";
import { Skeleton } from "@/components/ui/primitives";
import { getLeagues, getMatchDetail, getModelGlance, getTopPicks } from "@/lib/api";
import type { MatchInsights } from "@/lib/types";

export default async function HomePage() {
  const [picks, leagues, glance] = await Promise.all([getTopPicks(), getLeagues(), getModelGlance()]);

  const radars: Record<string, MatchInsights["radar"]> = {};
  for (const id of new Set(picks.map((p) => p.matchId))) {
    const detail = await getMatchDetail(id);
    if (detail) radars[id] = detail.insights.radar;
  }

  return (
    <PageColumns right={<ModelGlance glance={glance} />}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <TopPicksView picks={picks} leagues={leagues} radars={radars} />
      </Suspense>
    </PageColumns>
  );
}
