import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Crest, LocalTime } from "@/components/ui/client";
import type { Match } from "@/lib/types";

export function MatchHeaderCard({ match, expectedGoals }: { match: Match; expectedGoals?: { home: number; away: number } }) {
  return (
    <section className="relative rounded-card border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Link
          href="/matches"
          aria-label="Back to matches"
          className="grid size-9 place-items-center rounded-[10px] bg-surface-2 text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="grid size-7 place-items-center rounded-full bg-text p-1">
          <Crest src={match.leagueLogo} name={match.league} size={18} />
        </span>
        <span className="text-sm text-muted">
          {match.league}
          {match.matchday ? ` · Matchday ${match.matchday}` : ""}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        {[match.home, match.away].map((team, i) => (
          <div key={team.id} className={i === 1 ? "order-3" : undefined}>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-text p-2.5 sm:size-20">
              <Crest src={team.crestUrl} name={team.name} size={52} />
            </span>
            <div className="mt-3 font-semibold sm:text-lg">{team.name}</div>
            <div className="text-xs text-muted">{i === 0 ? "Home" : "Away"}</div>
          </div>
        ))}
        <div className="order-2 px-2">
          {match.score ? (
            <div className="tabular text-4xl font-bold sm:text-5xl">
              {match.score.home} – {match.score.away}
            </div>
          ) : (
            <div className="text-3xl font-bold sm:text-4xl">
              <LocalTime iso={match.kickoff} format="time" />
            </div>
          )}
          {match.status === "live" && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-fill px-2 py-0.5 text-xs font-bold text-on-accent">
              <span className="size-1.5 animate-pulse rounded-full bg-on-accent" aria-hidden /> LIVE {match.statusDetail}
            </div>
          )}
          {(match.status === "finished" || match.status === "postponed" || match.status === "cancelled") && (
            <div className="mt-1 text-xs font-semibold text-muted uppercase">
              {match.status === "finished" ? (match.statusDetail ?? "Full time") : match.status}
            </div>
          )}
          <div className="mt-1 text-sm text-muted">
            <LocalTime iso={match.kickoff} format="day" />
          </div>
          {expectedGoals && (
            <div className="tabular mt-3 inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
              Baseline xG {expectedGoals.home.toFixed(2)} – {expectedGoals.away.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
