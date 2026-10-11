import { Suspense } from "react";
import { CalibrationChart } from "@/components/charts/lazy";
import { PerformanceView } from "@/components/performance/performance-view";
import { PageColumns } from "@/components/shell/page-columns";
import { Card, Skeleton, StatCard } from "@/components/ui/primitives";
import { getCalibration, getLeagues, getPastPredictions, getRetrains } from "@/lib/api";
import { AnimatedNumber } from "@/components/ui/client";
import { SAMPLE_DATA_NOTE } from "@/lib/sources";
import { readPicks } from "@/lib/server/picks-store";

export const metadata = { title: "Performance · BetMind" };

export default async function PerformancePage() {
  const [past, leagues, retrains, calibration] = await Promise.all([
    getPastPredictions(),
    getLeagues(),
    getRetrains(),
    getCalibration(),
  ]);

  // Learning from mistakes: real saved picks that lost at high confidence.
  const savedMisses = (await readPicks())
    .filter((p) => p.status === "lost" && p.confidence === "high")
    .sort((a, b) => b.modelProb - a.modelProb)
    .slice(0, 5);

  const settled = past.filter((p) => p.result !== "void");
  const won = settled.filter((p) => p.result === "won").length;
  const profit = settled.reduce((s, p) => s + p.profit, 0);
  const avgEv = past.reduce((s, p) => s + p.ev, 0) / (past.length || 1);

  const right = (
    <>
      <StatCard label="Total predictions" value={<AnimatedNumber value={past.length} />} hint={`${settled.length} settled, ${past.length - settled.length} void`} />
      <StatCard label="Hit rate" value={<AnimatedNumber value={won / (settled.length || 1)} decimals={1} percent />} hint={`${won} of ${settled.length} won`} highlight />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="ROI" value={<AnimatedNumber value={profit / (settled.length || 1)} decimals={1} percent signed />} />
        <StatCard label="Avg EV" value={<AnimatedNumber value={avgEv} decimals={1} percent signed />} />
      </div>
      <Card title="Calibration">
        <CalibrationChart data={calibration} />
        <p className="mt-2 text-xs text-muted">
          Predicted probability vs. actual hit rate. Closer to the dashed line means better-calibrated.
        </p>
      </Card>
    </>
  );

  return (
    <PageColumns right={right}>
      <h1 className="sr-only">Performance</h1>
      <div role="note" className="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        {SAMPLE_DATA_NOTE}
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <PerformanceView past={past} leagues={leagues} retrains={retrains} savedMisses={savedMisses} />
      </Suspense>
    </PageColumns>
  );
}
