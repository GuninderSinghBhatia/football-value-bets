import { RoiAreaChart } from "@/components/charts/lazy";
import { NbaHeader } from "@/components/nba/nba-tabs";
import { PageColumns } from "@/components/shell/page-columns";
import { Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { pct, signedPct, units } from "@/lib/format";
import { readPerformance } from "@/lib/server/nba-store";
import { cn } from "@/lib/utils";

export const metadata = { title: "NBA performance · BetMind" };
export const dynamic = "force-dynamic";

const GATE3_BETS = 300;

export default async function NbaPerformancePage() {
  const perf = await readPerformance();
  const s = perf?.summary;
  const g = perf?.gate2;

  const right = (
    <>
      <StatCard label="ROI" value={s?.roi != null ? signedPct(s.roi) : "–"} hint={s?.roi_ci95 ? `95% CI ${signedPct(s.roi_ci95[0])} to ${signedPct(s.roi_ci95[1])}` : "needs settled bets"} highlight />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Win rate" value={s?.win_rate != null ? pct(s.win_rate) : "–"} hint={s ? `${s.won} of ${s.settled}` : undefined} />
        <StatCard label="Max drawdown" value={s ? units(-s.max_drawdown) : "–"} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Avg CLV" value={s?.avg_clv != null ? signedPct(s.avg_clv) : "–"} />
        <StatCard label="CLV > 0" value={s?.positive_clv_share != null ? pct(s.positive_clv_share) : "–"} hint="share of bets" />
      </div>
      <Card title="Gate 3 progress">
        <div className="h-2 rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, ((s?.settled ?? 0) / GATE3_BETS) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {s?.settled ?? 0} of {GATE3_BETS} settled bets. Judge the model on CLV and ROI only after that many.
        </p>
      </Card>
    </>
  );

  return (
    <PageColumns right={right}>
      <NbaHeader generatedAt={perf?.generated_at} />

      <Card title="Profit over time" action={<span className="text-xs text-muted">Settled paper bets, units</span>}>
        {perf && perf.curve.length > 0 ? (
          <RoiAreaChart data={perf.curve} />
        ) : (
          <EmptyState title="Nothing settled yet" hint="The curve fills in as tonight's games finish and the pipeline settles them." />
        )}
      </Card>

      <Card title="Gate 2: model vs the line" action={<span className="text-xs text-muted">same player-games, latest pre-game line</span>}>
        {!g || g.n === 0 ? (
          <EmptyState title="No finished props yet" hint="Every predicted prop counts here once the game is final, not just the bets." />
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium sm:pl-5">Measure</th>
                    <th className="px-2 py-2 text-right font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium sm:pr-5">DraftKings line</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  <tr className="border-b">
                    <td className="px-4 py-2 sm:pl-5">MAE (points)</td>
                    <td className={cn("px-2 py-2 text-right", g.model_mae! <= g.line_mae! && "text-positive")}>{g.model_mae!.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right sm:pr-5">{g.line_mae!.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 sm:pl-5">P(over) log loss</td>
                    <td className={cn("px-2 py-2 text-right", g.model_logloss! < g.line_logloss! && "text-positive")}>{g.model_logloss!.toFixed(4)}</td>
                    <td className="px-4 py-2 text-right sm:pr-5">{g.line_logloss!.toFixed(4)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm">
              <span className={cn("font-semibold", g.passes ? "text-positive" : "text-negative-text")}>{g.passes ? "Passing" : "Not passing"}</span>
              <span className="text-muted"> on {g.n} player-games. Gate 2 needs both rows green, on a sample big enough to trust.</span>
            </p>
          </>
        )}
      </Card>

      <Card title="By month">
        {!perf || perf.by_month.length === 0 ? (
          <EmptyState title="No months yet" />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium sm:pl-5">Month</th>
                  <th className="px-2 py-2 text-right font-medium">Bets</th>
                  <th className="px-2 py-2 text-right font-medium">Profit</th>
                  <th className="px-2 py-2 text-right font-medium">ROI</th>
                  <th className="px-4 py-2 text-right font-medium sm:pr-5">Avg CLV</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {perf.by_month.map((m) => (
                  <tr key={m.period} className="border-b last:border-0">
                    <td className="px-4 py-2 sm:pl-5">{m.period}</td>
                    <td className="px-2 py-2 text-right">{m.bets}</td>
                    <td className="px-2 py-2 text-right">{units(m.profit)}</td>
                    <td className="px-2 py-2 text-right">{signedPct(m.roi)}</td>
                    <td className="px-4 py-2 text-right sm:pr-5">{m.avg_clv != null ? signedPct(m.avg_clv) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageColumns>
  );
}
