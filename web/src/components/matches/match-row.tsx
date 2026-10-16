"use client";

import Link from "next/link";
import { Crest, LocalTime } from "@/components/ui/client";
import { OddsPill } from "@/components/ui/primitives";
import { odds, shortSelection, signedPct } from "@/lib/format";
import type { BetPrediction, Match } from "@/lib/types";
import { cn } from "@/lib/utils";

const ODDS_LABEL: Record<string, string> = { Home: "1", Draw: "X", Away: "2" };

export function MatchRow({ match, result, best }: { match: Match; result: BetPrediction[]; best?: BetPrediction }) {
  return (
    <Link
      href={`/match/${match.id}`}
      className="grid grid-cols-[3.25rem_minmax(0,1fr)] pressable items-center gap-x-3 gap-y-3 rounded-xl bg-surface-2/60 px-3 py-3 hover:bg-surface-2 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto]"
    >
      <span className="text-sm font-semibold">
        {match.status === "live" ? (
          <span className="inline-flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-negative-bg px-1.5 py-0.5 text-[10px] font-bold text-negative-text">
              <span className="size-1.5 animate-pulse rounded-full bg-negative" aria-hidden /> LIVE
            </span>
            <span className="text-xs text-negative-text">{match.statusDetail}</span>
          </span>
        ) : match.status === "finished" ? (
          <span className="text-xs text-muted">{match.statusDetail ?? "FT"}</span>
        ) : match.status === "postponed" || match.status === "cancelled" ? (
          <span className="text-xs text-warning capitalize">{match.status}</span>
        ) : (
          <LocalTime iso={match.kickoff} format="time" />
        )}
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Crest src={match.home.crestUrl} name={match.home.name} size={24} />
          <span className={cn("truncate", match.winner === "away" && "text-muted")}>{match.home.name}</span>
          {match.scoreLine ? (
            <span className="tabular max-w-[50%] shrink-0 truncate rounded-md bg-bg px-2 py-0.5 text-sm font-bold">{match.scoreLine}</span>
          ) : match.score ? (
            <span className="tabular shrink-0 rounded-md bg-bg px-2 py-0.5 text-sm font-bold">
              {match.score.home} – {match.score.away}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted">vs</span>
          )}
          <span className={cn("truncate", match.winner === "home" && "text-muted")}>{match.away.name}</span>
          <Crest src={match.away.crestUrl} name={match.away.name} size={24} />
        </div>
        {match.round && <div className="mt-1 truncate text-xs text-muted">{match.round}</div>}
      </div>

      <div className="col-start-2 flex gap-1.5 sm:col-start-auto">
        {result.map((p) => (
          <OddsPill
            key={p.selection}
            label={ODDS_LABEL[p.selection]}
            odds={odds(p.odds)}
            highlight={best?.market === "1X2" && best.selection === p.selection && best.ev > 0}
          />
        ))}
      </div>

      {best && (
        <span
          className={cn(
            "col-start-2 justify-self-start rounded-full px-3 py-1 text-xs font-semibold sm:col-span-2",
            best.ev > 0 ? "bg-positive/15 text-positive" : "bg-surface-2 text-muted",
          )}
        >
          Best pick: {shortSelection(best.market, best.selection)} · EV {signedPct(best.ev)}
        </span>
      )}
    </Link>
  );
}
