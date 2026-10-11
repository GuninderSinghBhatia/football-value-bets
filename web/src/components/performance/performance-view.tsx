"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import { RoiAreaChart } from "@/components/charts/lazy";
import { useSetParam } from "@/lib/use-set-param";
import { AnimatedNumber, LocalTime, useMounted } from "@/components/ui/client";
import { Pagination } from "@/components/ui/pagination";
import { Card, Chip, EmptyState, Skeleton } from "@/components/ui/primitives";
import { MARKET_OPTIONS, leagueOptions, type MarketFilter } from "@/components/ui/filter-options";
import { Select } from "@/components/ui/select";
import { odds, pct, shortSelection, signedPct, units } from "@/lib/format";
import type { League, PastPrediction, Retrain, SavedPick } from "@/lib/types";
import { cn } from "@/lib/utils";

type Period = "month" | "lastMonth" | "all";
const PAGE_SIZE = 10;

function inPeriod(iso: string, period: Period, now: Date) {
  if (period === "all") return true;
  const d = new Date(iso);
  const month = new Date(now.getFullYear(), now.getMonth() - (period === "lastMonth" ? 1 : 0), 1);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

export function PerformanceView({
  past,
  leagues,
  retrains,
  savedMisses = [],
}: {
  past: PastPrediction[];
  leagues: League[];
  retrains: Retrain[];
  /** Real saved picks that lost at high confidence (from the tracker). */
  savedMisses?: SavedPick[];
}) {
  return (
    <>
      <RoiCard past={past} />
      <HistoryCard past={past} leagues={leagues} />
      <MistakesCard past={past} retrains={retrains} savedMisses={savedMisses} />
    </>
  );
}

function RoiCard({ past }: { past: PastPrediction[] }) {
  const mounted = useMounted();
  const [period, setPeriod] = useState<Period>("all");

  const chosen = mounted
    ? past.filter((p) => inPeriod(p.settledAt, period, new Date())).sort((a, b) => a.settledAt.localeCompare(b.settledAt))
    : [];
  let running = 0;
  const data = chosen.map((p) => ({
    date: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(p.settledAt)),
    profit: Math.round((running += p.profit) * 100) / 100,
  }));
  const staked = chosen.filter((p) => p.result !== "void").length;
  const roi = staked ? running / staked : 0;

  return (
    <Card
      title={<span className="text-lg">Profit over time</span>}
      action={
        <div className="flex gap-2" role="group" aria-label="Period">
          {(
            [
              ["month", "This month"],
              ["lastMonth", "Last month"],
              ["all", "All time"],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={period === value} onClick={() => setPeriod(value)}>
              {label}
            </Chip>
          ))}
        </div>
      }
    >
      {!mounted ? (
        <Skeleton className="h-[300px] w-full" />
      ) : data.length === 0 ? (
        <EmptyState title="No settled picks in this period" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="text-xs text-muted">Profit (1u flat stakes)</div>
              <div className={cn("tabular text-3xl font-bold", running >= 0 ? "text-positive" : "text-negative-text")}>
                <AnimatedNumber value={running} decimals={2} suffix="u" signed />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">ROI</div>
              <div className={cn("tabular text-3xl font-bold", roi >= 0 ? "text-positive" : "text-negative-text")}>
                <AnimatedNumber value={roi} decimals={1} percent signed />
              </div>
            </div>
          </div>
          <RoiAreaChart data={data} />
        </>
      )}
    </Card>
  );
}

function ResultMark({ result }: { result: PastPrediction["result"] }) {
  if (result === "won")
    return (
      <span className="inline-flex items-center gap-1 text-positive">
        <Check className="size-4" aria-hidden /> Won
      </span>
    );
  if (result === "lost")
    return (
      <span className="inline-flex items-center gap-1 text-negative-text">
        <X className="size-4" aria-hidden /> Lost
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted">
      <Minus className="size-4" aria-hidden /> Void
    </span>
  );
}

function HistoryCard({ past, leagues }: { past: PastPrediction[]; leagues: League[] }) {
  const params = useSearchParams();
  const setParam = useSetParam();
  const league = params.get("league") ?? "all";
  const [market, setMarket] = useState<MarketFilter>("all");
  const [page, setPage] = useState(0);

  const rows = past.filter((p) => (league === "all" || p.match.leagueId === league) && (market === "all" || p.market === market));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card title="Prediction history">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-lg">
        <Select
          label="League"
          value={league}
          onChange={(v) => {
            setParam("league", v === "all" ? null : v);
            setPage(0);
          }}
          options={leagueOptions(leagues)}
        />
        <Select
          label="Market"
          value={market}
          onChange={(v) => {
            setMarket(v);
            setPage(0);
          }}
          options={MARKET_OPTIONS}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No predictions yet" hint="Nothing has settled for this league and market." />
      ) : (
        <>
          <div className="relative -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Match</th>
                  <th className="pb-2 font-normal">Selection</th>
                  <th className="pb-2 text-right font-normal">Odds</th>
                  <th className="pb-2 text-right font-normal">Model</th>
                  <th className="pb-2 pl-5 font-normal">Result</th>
                  <th className="pb-2 text-right font-normal">P/L</th>
                </tr>
              </thead>
              <tbody key={`${league}|${market}|${page}`} className="stagger-fade">
                {pageRows.map((p) => (
                  <tr key={p.matchId} className="border-t">
                    <td className="py-2.5 whitespace-nowrap text-muted">
                      <LocalTime iso={p.settledAt} format="day" />
                    </td>
                    <td className="py-2.5">
                      {p.match.home.name} vs {p.match.away.name}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">{shortSelection(p.market, p.selection)}</td>
                    <td className="tabular py-2.5 text-right">{odds(p.odds)}</td>
                    <td className="tabular py-2.5 text-right">{pct(p.modelProb)}</td>
                    <td className="py-2.5 pl-5">
                      <ResultMark result={p.result} />
                    </td>
                    <td
                      className={cn(
                        "tabular py-2.5 text-right font-semibold",
                        p.profit > 0 ? "text-positive" : p.profit < 0 ? "text-negative-text" : "text-muted",
                      )}
                    >
                      {units(p.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={Math.ceil(rows.length / PAGE_SIZE)} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

const NOTES_KEY = "betmind-miss-notes";

function MistakesCard({ past, retrains, savedMisses }: { past: PastPrediction[]; retrains: Retrain[]; savedMisses: SavedPick[] }) {
  const misses = past
    .filter((p) => p.result === "lost" && p.confidence === "high")
    .sort((a, b) => b.modelProb - a.modelProb)
    .slice(0, 5);

  // Notes are a personal scratchpad, so browser storage is enough. It may be unavailable.
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      setNotes(JSON.parse(localStorage.getItem(NOTES_KEY) ?? "{}"));
    } catch {}
  }, []);
  const saveNote = (id: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev, [id]: text };
      try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <Card title="Learning from mistakes">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          {savedMisses.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-3 text-sm text-muted">From your saved picks</h3>
              <ul className="stagger space-y-3">
                {savedMisses.map((p) => (
                  <li key={p.id} className="rounded-xl border border-negative/30 bg-surface-2 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link href={`/match/${p.matchId}`} className="font-medium hover:underline">
                        {p.match.home.name} vs {p.match.away.name}
                      </Link>
                      <span className="text-xs text-muted">
                        Final {p.finalScore} · <LocalTime iso={p.match.kickoff} format="date" />
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {shortSelection(p.market, p.selection)} @ {odds(p.oddsAtSave)} · model {pct(p.modelProb)} · EV {signedPct(p.ev)} ·{" "}
                      {p.modelVersion} · <span className="text-negative-text">✗ lost</span>
                    </div>
                    {p.note && <p className="mt-2 text-sm text-muted">Your note: “{p.note}”</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="mb-3 text-sm text-muted">
            Biggest misses (high-confidence picks that lost){savedMisses.length > 0 ? " · sample history" : ""}
          </h3>
          {misses.length === 0 ? (
            <EmptyState title="No high-confidence misses" />
          ) : (
            <ul className="stagger space-y-3">
              {misses.map((p) => (
                <li key={p.matchId} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {p.match.home.name} vs {p.match.away.name}
                    </span>
                    <span className="text-xs text-muted">
                      <LocalTime iso={p.settledAt} format="date" />
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {shortSelection(p.market, p.selection)} @ {odds(p.odds)} · model {pct(p.modelProb)} ·{" "}
                    <span className="text-negative-text">✗ lost</span>
                  </div>
                  <label className="mt-2 block">
                    <span className="sr-only">Note</span>
                    <textarea
                      rows={2}
                      value={notes[p.matchId] ?? ""}
                      onChange={(e) => saveNote(p.matchId, e.target.value)}
                      placeholder="What did the model miss? (e.g. late injury, red card)"
                      className="w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm placeholder:text-muted"
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm text-muted">Model retrains</h3>
          <ol className="space-y-3 border-l pl-4">
            {retrains.map((r) => (
              <li key={r.version} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-accent" aria-hidden />
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{r.version}</span>
                  <span className="text-xs text-muted">
                    <LocalTime iso={`${r.date}T12:00:00Z`} format="date" />
                  </span>
                </div>
                <div className="text-sm text-muted">{r.note}</div>
                <div className="tabular text-xs text-muted">Log loss {r.logLoss.toFixed(3)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
