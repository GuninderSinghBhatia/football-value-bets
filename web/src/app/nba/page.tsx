import { NbaHeader } from "@/components/nba/nba-tabs";
import { TonightView } from "@/components/nba/props-table";
import { PageColumns } from "@/components/shell/page-columns";
import { Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { pct } from "@/lib/format";
import { readTonight } from "@/lib/server/nba-store";

export const metadata = { title: "NBA props · BetMind" };
export const dynamic = "force-dynamic";

export default async function NbaTonightPage() {
  const tonight = await readTonight();
  const props = tonight?.games.flatMap((g) => g.props) ?? [];
  const predicted = props.filter((p) => p.predicted_points != null);
  const picks = props.filter((p) => p.pick);
  const avgGap = predicted.length
    ? predicted.reduce((s, p) => s + (p.predicted_points! - p.line), 0) / predicted.length
    : null;

  const right = (
    <>
      <StatCard label="Points lines" value={props.length} hint={`${predicted.length} with a model prediction`} />
      <StatCard
        label="Paper picks"
        value={picks.length}
        hint={tonight ? `EV above ${pct(tonight.ev_threshold)} on one side` : undefined}
        highlight
      />
      <StatCard
        label="Model vs line"
        value={avgGap == null ? "–" : `${avgGap >= 0 ? "+" : "−"}${Math.abs(avgGap).toFixed(2)}`}
        hint="Average predicted points minus the line. Near 0 = no overall bias."
      />
      <Card title="How to read this">
        <p className="text-sm text-muted">
          P(over) comes from the model&apos;s past errors at this scoring level. Book P(over) is DraftKings&apos; price
          with the bookmaker&apos;s cut removed. A pick needs EV above the threshold, at most one side per player.
          Opening-night picks use last season&apos;s averages, so treat them with care.
        </p>
      </Card>
    </>
  );

  return (
    <PageColumns right={right}>
      <NbaHeader generatedAt={tonight?.generated_at} />
      {tonight ? (
        <TonightView games={tonight.games} evThreshold={tonight.ev_threshold} />
      ) : (
        <Card>
          <EmptyState title="The NBA pipeline hasn't run yet" hint="Run .venv/Scripts/python.exe nba/scripts/run_pipeline.py from the repo root." />
        </Card>
      )}
    </PageColumns>
  );
}
