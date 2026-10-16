"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { MatchRow } from "./match-row";
import { Crest, useMounted } from "@/components/ui/client";
import { X } from "lucide-react";
import { useFavourites } from "@/components/shell/favourites";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/select";
import { useSetParam } from "@/lib/use-set-param";
import { dateBucket } from "@/lib/format";
import { useSport } from "@/lib/use-sport";
import { sportOf } from "@/config/sports";
import type { BetPrediction, League, Match } from "@/lib/types";

type Tab = "all" | "today" | "tomorrow" | "week" | "results";
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "Week" },
  { value: "results", label: "Results" },
];
const RESULT_DAYS = 7;

export function MatchesView({
  matches,
  odds,
  best,
  leagues,
}: {
  matches: Match[];
  odds: Record<string, BetPrediction[]>;
  best: Record<string, BetPrediction>;
  /** Leagues of a non-football sport; football uses the favourites list. */
  leagues?: League[];
}) {
  const mounted = useMounted();
  const params = useSearchParams();
  const league = params.get("league");
  const q = (params.get("q") ?? "").toLowerCase();
  const [tab, setTab] = useState<Tab>("all");
  const setParam = useSetParam();
  const sport = sportOf(useSport());
  const footballLeagues = useFavourites().leagues;
  const activeLeague = (leagues ?? footballLeagues).find((l) => l.id === league);

  // Upcoming tabs show games not yet finished (live included); Results shows the last week, newest first.
  const now = Date.now();
  const filtered = mounted
    ? matches
        .filter((m) => {
          if (league && m.leagueId !== league) return false;
          if (q && !`${m.home.name} ${m.away.name}`.toLowerCase().includes(q)) return false;
          if (tab === "results")
            return m.status === "finished" && now - new Date(m.kickoff).getTime() < RESULT_DAYS * 86_400_000;
          if (m.status !== "scheduled" && m.status !== "live") return false;
          const bucket = dateBucket(m.kickoff);
          return tab === "all" || (tab === "week" ? bucket !== "later" || m.status === "live" : bucket === tab);
        })
        .sort((a, b) => (tab === "results" ? -1 : 1) * a.kickoff.localeCompare(b.kickoff))
    : [];

  // Group by league, then by local calendar day.
  const groups = new Map<string, { logo: string; days: Map<string, Match[]> }>();
  for (const m of filtered) {
    const g = groups.get(m.league) ?? { logo: m.leagueLogo, days: new Map() };
    const day = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date(m.kickoff));
    g.days.set(day, [...(g.days.get(day) ?? []), m]);
    groups.set(m.league, g);
  }

  return (
    <Card title={<span className="text-lg">{tab === "results" ? "Results" : "Upcoming matches"}</span>}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-[30rem]">
          <Segmented label="Kickoff" value={tab} onChange={setTab} options={TABS} />
        </div>
        {activeLeague && (
          <button
            type="button"
            onClick={() => setParam("league", null)}
            aria-label={`Clear ${activeLeague.name} filter`}
            className="inline-flex h-10 animate-fade-in items-center gap-2 rounded-xl bg-accent/10 pr-2.5 pl-1.5 text-sm font-medium ring-1 ring-accent/60 transition-all duration-200 hover:bg-accent/20 active:scale-95"
          >
            <span className="grid size-7 place-items-center rounded-full bg-text p-1">
              <Crest src={activeLeague.logoUrl} name={activeLeague.name} size={18} />
            </span>
            {activeLeague.name}
            <X className="size-4 text-muted" />
          </button>
        )}
      </div>

      {!mounted ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groups.size === 0 ? (
        sport.id === "football" ? (
          <EmptyState title="No matches found" hint="Try another date range, league or search." />
        ) : (
          <EmptyState
            title={tab === "results" ? `No ${sport.label} results in the last week` : `No upcoming ${sport.label} matches`}
            hint="Try another date range, league or search."
          />
        )
      ) : (
        <div key={`${tab}|${league}|${q}`} className="space-y-6">
          {[...groups.entries()].map(([name, g]) => (
            <section key={name}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-text p-1">
                  <Crest src={g.logo} name={name} size={18} />
                </span>
                {name}
              </h2>
              <div className="space-y-4">
                {[...g.days.entries()].map(([day, dayMatches]) => (
                  <div key={day}>
                    <h3 className="mb-2 text-sm text-muted">{day}</h3>
                    <ul className="stagger space-y-2">
                      {dayMatches.map((m) => (
                        <li key={m.id}>
                          <MatchRow match={m} result={odds[m.id] ?? []} best={best[m.id]} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
