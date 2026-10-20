import Link from "next/link";
import { notFound } from "next/navigation";
import { NbaHeader } from "@/components/nba/nba-tabs";
import { PageColumns } from "@/components/shell/page-columns";
import { Card, EvText, StatCard } from "@/components/ui/primitives";
import { pct } from "@/lib/format";
import { american, bestSide } from "@/lib/nba";
import { readBets, readTonight } from "@/lib/server/nba-store";
import { cn } from "@/lib/utils";

export const metadata = { title: "NBA player · BetMind" };
export const dynamic = "force-dynamic";

const FEATURE_LABELS: [key: string, label: string, fmt: (v: number) => string][] = [
  ["f_points_last10", "Points, last 10", (v) => v.toFixed(1)],
  ["f_points_season_avg", "Season average", (v) => v.toFixed(1)],
  ["f_minutes_last10", "Minutes, last 10", (v) => v.toFixed(1)],
  ["f_usage_last10", "Usage share, last 10", (v) => pct(v)],
  ["f_missing_pts", "Team scoring missing tonight", (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} pts`],
  ["f_opp_def_rating_last10", "Opponent defence (pts / 100 poss)", (v) => v.toFixed(1)],
  ["f_rest_days", "Rest days", (v) => v.toFixed(0)],
];

export default async function NbaPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const [{ id }, { game }] = await Promise.all([params, searchParams]);
  const [tonight, bets] = await Promise.all([readTonight(), readBets()]);
  const props = tonight?.games.flatMap((g) => g.props).filter((p) => String(p.player_id) === id) ?? [];
  const prop = props.find((p) => p.event_id === game) ?? props[0];
  if (!prop) notFound();

  const best = bestSide(prop);
  const history = bets.filter((b) => String(b.player_id) === id);
  const maxPts = Math.max(prop.line, ...prop.last10.map((g) => g.points), 1);

  const right = (
    <>
      <StatCard
        label="Predicted points"
        value={prop.predicted_points != null ? prop.predicted_points.toFixed(1) : "–"}
        hint={prop.sd != null ? `typical miss ± ${prop.sd.toFixed(1)}` : prop.skip_reason ?? undefined}
        highlight
      />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Line" value={prop.line} hint={`${american(prop.over_odds)} / ${american(prop.under_odds)}`} />
        <StatCard label="P(over)" value={prop.p_over != null ? pct(prop.p_over) : "–"} hint={prop.no_vig_p_over != null ? `book ${pct(prop.no_vig_p_over)}` : undefined} />
      </div>
      <StatCard
        label="Pick"
        value={prop.pick ? <span className="capitalize">{prop.pick} {prop.line}</span> : "No bet"}
        hint={best ? `best side ${best.side}, EV ${best.ev >= 0 ? "+" : "−"}${Math.abs(best.ev * 100).toFixed(1)}%` : undefined}
      />
    </>
  );

  return (
    <PageColumns right={right}>
      <NbaHeader generatedAt={tonight?.generated_at} />
      <Card
        title={
          <span>
            {prop.player} <span className="font-normal text-muted">· {prop.team} vs {prop.opponent}</span>
          </span>
        }
        action={
          <Link href="/nba" className="text-sm text-info hover:underline">
            Back to tonight
          </Link>
        }
      >
        <h3 className="mb-3 text-xs font-medium text-muted">Last 10 games vs tonight&apos;s line ({prop.line})</h3>
        {prop.last10.length === 0 ? (
          <p className="text-sm text-muted">No earlier games in the data.</p>
        ) : (
          <ol className="space-y-1.5">
            {prop.last10.map((g) => (
              <li key={g.date} className="grid grid-cols-[88px_64px_minmax(0,1fr)_40px] items-center gap-3 text-sm">
                <span className="tabular text-muted">{g.date}</span>
                <span className="text-muted">
                  {g.home ? "vs" : "@"} {g.opponent}
                </span>
                <span className="relative h-2.5 rounded-full bg-surface-2">
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-full", g.points > prop.line ? "bg-positive" : "bg-negative")}
                    style={{ width: `${(g.points / maxPts) * 100}%` }}
                  />
                  <span aria-hidden className="absolute inset-y-[-3px] w-px bg-text" style={{ left: `${(prop.line / maxPts) * 100}%` }} />
                </span>
                <span className="tabular text-right font-semibold">{g.points}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-muted">
          {prop.last10.filter((g) => g.points > prop.line).length} of {prop.last10.length} went over {prop.line}. The thin
          line marks tonight&apos;s line.
        </p>
      </Card>

      <Card title="What the model sees">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {FEATURE_LABELS.map(([key, label, fmt]) => {
            const v = prop[key as keyof typeof prop] as number | null | undefined;
            return (
              <div key={key} className="flex justify-between border-b py-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="tabular font-medium">{v == null ? "–" : fmt(v)}</dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {history.length > 0 && (
        <Card title="Paper trades on this player">
          <ul className="space-y-2 text-sm">
            {history.map((b) => (
              <li key={b.bet_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span>
                  <span className="font-medium capitalize">
                    {b.side} {b.line}
                  </span>{" "}
                  <span className="text-muted">
                    {american(b.odds)} · vs {b.opponent} · {b.start_time.slice(0, 10)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <EvText ev={b.ev} />
                  <span className="capitalize text-muted">{b.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageColumns>
  );
}
