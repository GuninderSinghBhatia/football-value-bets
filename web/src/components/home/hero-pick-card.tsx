"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RadarCompare } from "@/components/charts/lazy";
import { AnimatedNumber, Crest, LocalTime } from "@/components/ui/client";
import { SaveButton } from "@/components/tracker/save-button";
import { selectionLabel } from "@/lib/format";
import type { MatchInsights, PickWithMatch } from "@/lib/types";

export function HeroPickCard({ pick, radar }: { pick: PickWithMatch; radar?: MatchInsights["radar"] }) {
  const { match } = pick;
  const watermark = `${match.home.name} `.repeat(6);

  return (
    <section
      aria-label="Top pick of the day"
      className="relative overflow-hidden rounded-card bg-gradient-cta p-5 text-on-accent sm:p-6"
    >
      {/* Faded repeated team name in the background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-2 overflow-hidden opacity-[0.05] select-none">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="animate-drift text-7xl font-black whitespace-nowrap uppercase"
            style={{ marginLeft: `${-row * 120}px`, animationDelay: `${-row * 5}s`, animationDirection: row % 2 ? "alternate-reverse" : "alternate" }}
          >
            {watermark}
          </div>
        ))}
      </div>

      <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-on-accent/10 px-3 py-1 text-xs font-semibold">
            #1 pick of the day · {match.league}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-text p-2 sm:size-16">
              <Crest src={match.home.crestUrl} name={match.home.name} size={40} />
            </span>
            <span className="text-sm font-semibold text-on-accent">vs</span>
            <span className="grid size-14 place-items-center rounded-full bg-text p-2 sm:size-16">
              <Crest src={match.away.crestUrl} name={match.away.name} size={40} />
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
            {match.home.name} vs {match.away.name}
          </h1>
          <div className="mt-1 text-sm text-on-accent">
            <LocalTime iso={match.kickoff} format="datetime" />
          </div>

          <div className="mt-5 text-sm text-on-accent">The bet</div>
          <div className="text-xl font-semibold">{selectionLabel(pick.market, pick.selection, match.home.name, match.away.name)}</div>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            {(
              [
                ["Odds", <AnimatedNumber key="o" value={pick.odds} decimals={2} />],
                ["Model", <AnimatedNumber key="m" value={pick.modelProb} decimals={1} percent />],
                ["EV", <AnimatedNumber key="e" value={pick.ev} decimals={1} percent signed />],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-on-accent">{label}</dt>
                <dd className="tabular text-3xl font-bold">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-on-accent">Confidence</dt>
              <dd className="mt-2 inline-flex rounded-full bg-on-accent px-3 py-1 text-xs font-semibold text-accent capitalize">
                {pick.confidence}
              </dd>
            </div>
          </dl>

          <Link
            href={`/match/${match.id}`}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-on-accent px-4 py-2.5 text-sm font-semibold text-text transition-colors duration-200 hover:bg-surface-2"
          >
            View match <ArrowRight className="size-4" />
          </Link>
          <span className="mt-6 ml-2 inline-block align-top">
            <SaveButton pick={pick} match={match} variant="light" />
          </span>
        </div>

        {radar && (
          <div className="rounded-card bg-on-accent/5 p-2">
            <RadarCompare home={radar.home} away={radar.away} homeName={match.home.name} awayName={match.away.name} onAccent />
          </div>
        )}
      </div>
    </section>
  );
}
