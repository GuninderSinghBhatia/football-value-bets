import { Suspense } from "react";
import { PageColumns } from "@/components/shell/page-columns";
import { TrackerCharts, TrackerView } from "@/components/tracker/tracker-view";
import { Skeleton } from "@/components/ui/primitives";
import { getLeagues } from "@/lib/api";

export const metadata = { title: "Tracker · BetMind" };

export default async function TrackerPage() {
  const leagues = await getLeagues();
  return (
    <PageColumns right={<TrackerCharts />}>
      <h1 className="sr-only">Saved predictions</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <TrackerView leagues={leagues} />
      </Suspense>
    </PageColumns>
  );
}
