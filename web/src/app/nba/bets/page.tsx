import { BetsView } from "@/components/nba/bets-view";
import { NbaHeader } from "@/components/nba/nba-tabs";
import { PageColumns } from "@/components/shell/page-columns";
import { StatCard } from "@/components/ui/primitives";
import { signedPct, units } from "@/lib/format";
import { readBets, readPerformance } from "@/lib/server/nba-store";

export const metadata = { title: "NBA paper trades · BetMind" };
export const dynamic = "force-dynamic";

export default async function NbaBetsPage() {
  const [bets, perf] = await Promise.all([readBets(), readPerformance()]);
  const s = perf?.summary;
  const right = (
    <>
      <StatCard label="Paper bets" value={bets.length} hint={s ? `${s.open} open · ${s.settled} settled · ${s.void} void` : undefined} />
      <StatCard label="Profit" value={s ? units(s.profit) : "–"} hint={s?.roi != null ? `ROI ${signedPct(s.roi)}` : "no settled bets yet"} highlight />
      <StatCard
        label="Avg CLV"
        value={s?.avg_clv != null ? signedPct(s.avg_clv) : "–"}
        hint="Our price vs DraftKings' no-vig closing line. Positive CLV is the best early sign of an edge."
      />
    </>
  );
  return (
    <PageColumns right={right}>
      <NbaHeader generatedAt={perf?.generated_at} />
      <BetsView bets={bets} />
    </PageColumns>
  );
}
