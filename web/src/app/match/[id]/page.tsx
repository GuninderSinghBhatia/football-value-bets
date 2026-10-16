import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { OddsCompareChart, RadarCompare, StatsRadarChart } from "@/components/charts/lazy";
import { BetsPanel } from "@/components/match/bets-panel";
import { MatchHeaderCard } from "@/components/match/match-header-card";
import { PageColumns } from "@/components/shell/page-columns";
import { Crest, LocalTime } from "@/components/ui/client";
import { Card, EmptyState, FactorBar, FormPills } from "@/components/ui/primitives";
import { SportComingSoon } from "@/components/shell/sport-coming-soon";
import { sportOfMatchId } from "@/config/sports";
import { getBookmakers, getMatchDetail, getSportMatchDetail } from "@/lib/api";
import { BOOK_NAMES, selectionLabel } from "@/lib/format";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Other sports: match-winner odds, the odds comparison chart and, where the feed has the data, a stats radar.
  if (sportOfMatchId(id) !== "football") {
    const [sportDetail, books] = await Promise.all([getSportMatchDetail(id), getBookmakers(sportOfMatchId(id))]);
    if (!sportDetail) notFound();
    const { match, predictions: rows, radar } = sportDetail;
    const records = match.records;
    const sportRight = (
      <>
        {radar ? (
          <Card title="Comparison">
            <StatsRadarChart radar={radar} homeName={match.home.name} awayName={match.away.name} />
            <p className="mt-2 text-xs text-muted">{radar.note}</p>
          </Card>
        ) : (
          (records?.home?.overall || records?.away?.overall) && (
            <Card title="Records">
              {(["home", "away"] as const).map((side) => (
                <div key={side} className="mb-2 flex items-center justify-between gap-2 text-sm last:mb-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <Crest src={match[side].crestUrl} name={match[side].name} size={20} />
                    <span className="truncate">{match[side].name}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold">{records?.[side]?.overall ?? "–"}</span>
                </div>
              ))}
              <p className="mt-3 text-xs text-muted">
                {match.sport === "ufc" ? "Career record, wins-losses-draws (ESPN)." : "Season record, wins-losses (ESPN)."}
              </p>
            </Card>
          )
        )}
        <SportComingSoon sport={match.sport ?? "football"} />
      </>
    );
    return (
      <PageColumns right={sportRight}>
        <h1 className="sr-only">
          {match.home.name} vs {match.away.name}
        </h1>
        <MatchHeaderCard match={match} />
        <BetsPanel predictions={rows} match={match} bookmakers={books} />
        {rows.some((r) => r.prices && r.prices.length > 1) && (
          <Card title="Odds by bookmaker">
            <OddsCompareChart
              rows={rows}
              names={{ Home: match.home.name, Away: match.away.name, Draw: "Draw" }}
              bookNames={BOOK_NAMES}
              height={260}
            />
            <p className="mt-2 text-xs text-muted">
              Bars are each bookmaker&apos;s implied probability (1 / odds). Dashed lines are the fair no-vig consensus. A bar
              below its line is a price longer than fair.
            </p>
          </Card>
        )}
      </PageColumns>
    );
  }

  const [detail, bookmakers] = await Promise.all([getMatchDetail(id), getBookmakers()]);
  if (!detail) notFound();

  const { match, predictions, insights, homeForm, awayForm } = detail;
  const best = predictions[0];
  const factors = best?.topFactors ?? [];
  const maxImpact = Math.max(...factors.map((f) => Math.abs(f.impact)), 0.01);
  const teamName = (teamId: string) => (teamId === match.home.id ? match.home.name : match.away.name);

  const right = (
    <>
      <Card title="Form">
        {[
          { team: match.home, form: homeForm },
          { team: match.away, form: awayForm },
        ].map(({ team, form }) => (
          <div key={team.id} className="mb-3 flex items-center justify-between gap-2 last:mb-0">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Crest src={team.crestUrl} name={team.name} size={20} />
              <span className="truncate">{team.name}</span>
            </span>
            <FormPills form={form} />
          </div>
        ))}
        <p className="mt-3 text-xs text-muted">Last 5 results, from ESPN.</p>
      </Card>

      <Card title="Head-to-head">
        {insights.h2h.length === 0 && <p className="text-sm text-muted">No recent meetings found.</p>}
        <ul className="stagger space-y-2">
          {insights.h2h.map((g) => (
            <li key={g.date} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <div className="mb-1 text-xs text-muted">
                <LocalTime iso={`${g.date}T12:00:00Z`} format="date" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{teamName(g.homeId)}</span>
                <span className="tabular shrink-0 font-semibold">
                  {g.homeGoals} – {g.awayGoals}
                </span>
                <span className="truncate text-right">{teamName(g.awayId)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Team comparison">
        <RadarCompare
          home={insights.radar.home}
          away={insights.radar.away}
          homeName={match.home.name}
          awayName={match.away.name}
          height={260}
        />
      </Card>
    </>
  );

  return (
    <PageColumns right={right}>
      <h1 className="sr-only">
        {match.home.name} vs {match.away.name}
      </h1>
      <MatchHeaderCard match={match} expectedGoals={insights.expectedGoals} />
      <BetsPanel predictions={predictions} match={match} bookmakers={bookmakers} />

      <Card
        title={
          best
            ? `Why the baseline likes ${selectionLabel(best.market, best.selection, match.home.name, match.away.name)}`
            : "Why the model thinks this"
        }
      >
        {factors.length === 0 ? (
          <EmptyState title="No factor breakdown yet" />
        ) : (
          <>
            <div className="space-y-4">
              {factors.map((f) => (
                <FactorBar key={f.feature} feature={f.feature} impact={f.impact} max={maxImpact} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              Placeholder baseline: each team&apos;s goals for/against vs. the league average (log scale). Positive values push toward this pick. Your model&apos;s SHAP values replace this later.
            </p>
          </>
        )}
      </Card>

      <Card title="Characteristics">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["home", "away"] as const).map((side) => {
            const c = insights.characteristics[side];
            const team = match[side];
            return (
              <div key={side} className="rounded-xl bg-surface-2 p-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                  <Crest src={team.crestUrl} name={team.name} size={22} />
                  {team.name}
                </div>
                <div className="mb-1 text-xs text-muted">Strengths</div>
                <ul className="mb-3 space-y-1">
                  {c.strengths.length === 0 && <li className="text-sm text-muted">None stand out</li>}
                  {c.strengths.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-positive">
                      <Check className="size-4 shrink-0" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
                <div className="mb-1 text-xs text-muted">Weaknesses</div>
                <ul className="space-y-1">
                  {c.weaknesses.length === 0 && <li className="text-sm text-muted">None stand out</li>}
                  {c.weaknesses.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-negative-text">
                      <X className="size-4 shrink-0" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </PageColumns>
  );
}
