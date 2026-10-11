"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HeroPickCard } from "./hero-pick-card";
import { SaveButton } from "@/components/tracker/save-button";
import { Crest, LocalTime, useMounted } from "@/components/ui/client";
import { Pagination } from "@/components/ui/pagination";
import { Card, ConfidenceBadge, EmptyState, EvText, Skeleton } from "@/components/ui/primitives";
import {
  CONFIDENCE_OPTIONS,
  DATE_OPTIONS,
  MARKET_OPTIONS,
  MIN_EV_OPTIONS,
  leagueOptions,
  type MarketFilter,
} from "@/components/ui/filter-options";
import { Segmented, Select } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { useSetParam } from "@/lib/use-set-param";
import { DATA_SOURCES_NOTE } from "@/lib/sources";
import { dateBucket, marketLabel, odds, pct, shortSelection } from "@/lib/format";
import type { Confidence, League, MatchInsights, PickWithMatch } from "@/lib/types";

const PAGE_SIZE = 8;
const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

type DateFilter = "today" | "tomorrow" | "week";

export function TopPicksView({
  picks,
  leagues,
  radars,
}: {
  picks: PickWithMatch[];
  leagues: League[];
  radars: Record<string, MatchInsights["radar"]>;
}) {
  const mounted = useMounted();
  const params = useSearchParams();
  const setParam = useSetParam();
  const league = params.get("league") ?? "all";
  const q = (params.get("q") ?? "").toLowerCase();

  const [date, setDate] = useState<DateFilter>("week");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [minEv, setMinEv] = useState("0");
  const [minConf, setMinConf] = useState<"low" | Confidence>("low");
  const [page, setPage] = useState(0);
  const update = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const activeFilters =
    Number(league !== "all") + Number(date !== "week") + Number(market !== "all") + Number(minEv !== "0") + Number(minConf !== "low");
  const resetFilters = () => {
    setParam("league", null);
    setDate("week");
    setMarket("all");
    setMinEv("0");
    setMinConf("low");
    setPage(0);
  };

  // Date buckets depend on the viewer's clock, so wait for the client render.
  if (!mounted) return <Skeleton className="h-96 w-full rounded-card" />;

  const filtered = picks.filter((p) => {
    const bucket = dateBucket(p.match.kickoff);
    return (
      (league === "all" || p.match.leagueId === league) &&
      (!q || `${p.match.home.name} ${p.match.away.name}`.toLowerCase().includes(q)) &&
      (date === "week" ? bucket !== "later" : bucket === date) &&
      (market === "all" || p.market === market) &&
      p.ev >= Number(minEv) &&
      CONF_RANK[p.confidence] >= CONF_RANK[minConf]
    );
  });
  const [hero] = filtered;
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {hero ? (
        <HeroPickCard pick={hero} radar={radars[hero.matchId]} />
      ) : (
        <EmptyState title="No picks match these filters" hint="Try a wider date range or a lower minimum EV." />
      )}

      <Card title="Top value bets">
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full sm:w-80">
              <Segmented label="Kickoff" value={date} onChange={update(setDate)} options={DATE_OPTIONS} />
            </div>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 animate-fade-in items-center gap-2 rounded-xl px-3 text-sm text-muted transition-all duration-200 hover:bg-surface-2 hover:text-text active:scale-95"
              >
                <RotateCcw className="size-4" /> Reset {activeFilters} filter{activeFilters > 1 ? "s" : ""}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Select
              label="League"
              value={league}
              onChange={(v) => {
                setParam("league", v === "all" ? null : v);
                setPage(0);
              }}
              options={leagueOptions(leagues)}
            />
            <Select label="Market" value={market} onChange={update(setMarket)} options={MARKET_OPTIONS} />
            <Select label="Min EV" value={minEv} onChange={update(setMinEv)} options={MIN_EV_OPTIONS} />
            <Select label="Confidence" value={minConf} onChange={update(setMinConf)} options={CONFIDENCE_OPTIONS} />
          </div>
        </div>

        <div className="@container">
        {rows.length === 0 ? (
          <EmptyState title="No value bets here" hint="Nothing clears the filters for this selection." />
        ) : (
          <>
            <div className="hidden grid-cols-[1.5rem_minmax(0,2fr)_minmax(0,1.3fr)_3rem_3.75rem_3.75rem_3.75rem_4.75rem_2.25rem] gap-3 px-3 pb-2 text-xs text-muted @2xl:grid">
              <span>#</span>
              <span>Match</span>
              <span>Bet</span>
              <span className="text-right">Odds</span>
              <span className="text-right">Model</span>
              <span className="text-right">Implied</span>
              <span className="text-right">EV</span>
              <span className="text-right">Confidence</span>
              <span className="sr-only">Save</span>
            </div>
            <ol key={[league, q, date, market, minEv, minConf, page].join("|")} className="stagger space-y-2">
              {rows.map((p, i) => (
                <li key={`${p.matchId}-${p.market}-${p.selection}`}>
                  <PickRow pick={p} rank={page * PAGE_SIZE + i + 1} />
                </li>
              ))}
            </ol>
            <Pagination page={page} pages={pages} onChange={setPage} />
          </>
        )}
        <p className="mt-4 text-xs text-muted">{DATA_SOURCES_NOTE}</p>
        </div>
      </Card>
    </>
  );
}

function PickRow({ pick: p, rank }: { pick: PickWithMatch; rank: number }) {
  return (
    <Link
      href={`/match/${p.matchId}`}
      className="pressable grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-3 hover:bg-surface-2 @2xl:grid-cols-[1.5rem_minmax(0,2fr)_minmax(0,1.3fr)_3rem_3.75rem_3.75rem_3.75rem_4.75rem_2.25rem]"
    >
      <span className="tabular text-sm font-semibold text-muted">{rank}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Crest src={p.match.home.crestUrl} name={p.match.home.name} size={20} />
          <span className="truncate text-sm font-medium">{p.match.home.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Crest src={p.match.away.crestUrl} name={p.match.away.name} size={20} />
          <span className="truncate text-sm font-medium">{p.match.away.name}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {p.match.league} · <LocalTime iso={p.match.kickoff} format="datetime" />
        </div>
        <div className="mt-1 text-sm @2xl:hidden">
          {shortSelection(p.market, p.selection)} @ <span className="tabular">{odds(p.odds)}</span>
          <span className="text-muted"> · model {pct(p.modelProb)}</span>
        </div>
      </div>

      <div className="hidden min-w-0 @2xl:block">
        <div className="truncate text-sm font-medium">{shortSelection(p.market, p.selection)}</div>
        <div className="truncate text-xs text-muted">{marketLabel(p.market)}</div>
      </div>
      <span className="tabular hidden text-right text-sm font-semibold @2xl:block">{odds(p.odds)}</span>
      <span className="tabular hidden text-right text-sm @2xl:block">{pct(p.modelProb)}</span>
      <span className="tabular hidden text-right text-sm text-muted @2xl:block">{pct(p.impliedProb)}</span>

      <div className="flex flex-col items-end gap-1 @2xl:contents">
        <EvText ev={p.ev} className="text-right text-sm" />
        <span className="@2xl:text-right">
          <ConfidenceBadge level={p.confidence} />
        </span>
        <SaveButton pick={p} match={p.match} />
      </div>
    </Link>
  );
}
