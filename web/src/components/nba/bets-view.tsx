"use client";

import { useState } from "react";
import Link from "next/link";
import { LocalTime } from "@/components/ui/client";
import { Card, EmptyState, EvText } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/select";
import { signedPct, units } from "@/lib/format";
import { american, type NbaBet } from "@/lib/nba";
import { cn } from "@/lib/utils";

type Tab = "open" | "settled";

const STATUS_STYLE: Record<NbaBet["status"], string> = {
  open: "bg-warning-bg text-warning",
  won: "bg-positive-bg text-positive",
  lost: "bg-negative-bg text-negative-text",
  void: "bg-surface-2 text-muted",
};

export function BetsView({ bets }: { bets: NbaBet[] }) {
  const [tab, setTab] = useState<Tab>("open");
  const [query, setQuery] = useState("");
  const open = bets.filter((b) => b.status === "open");
  const settled = bets.filter((b) => b.status !== "open");
  const shown = (tab === "open" ? open : settled)
    .filter((b) => !query || b.player.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (tab === "open" ? a.start_time.localeCompare(b.start_time) : b.start_time.localeCompare(a.start_time)));

  return (
    <Card title="Paper bets">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Segmented
          label="Status"
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: `Open (${open.length})` },
            { value: "settled", label: `Settled (${settled.length})` },
          ]}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Player</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a player"
            className="h-10 rounded-full bg-surface-2 px-4 text-sm outline-none placeholder:text-faint"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === "open" ? "No open paper bets" : "Nothing settled yet"}
          hint={tab === "open" ? "Bets appear when a prop's EV clears the threshold." : "Bets settle from ESPN box scores after the game ends."}
        />
      ) : (
        <ul className="stagger space-y-2">
          {shown.map((b) => (
            <li key={b.bet_id} className="grid gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/nba/player/${b.player_id}?game=${b.event_id}`} className="font-medium text-info hover:underline">
                    {b.player}
                  </Link>
                  <span className="font-semibold capitalize">
                    {b.side} {b.line}
                  </span>
                  <span className="tabular text-muted">{american(b.odds)}</span>
                  {b.season_start && <span className="rounded-full bg-caution-bg px-2 py-0.5 text-[11px] text-caution">1st game</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {b.team} vs {b.opponent} · <LocalTime iso={b.start_time} format="datetime" /> · predicted {b.predicted_points.toFixed(1)} · DraftKings
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <span className="text-xs text-muted">
                  EV <EvText ev={b.ev} />
                </span>
                {b.close_line != null && (
                  <span className="tabular text-xs text-muted">
                    close {b.close_line} ({american(b.close_over_odds)} / {american(b.close_under_odds)})
                  </span>
                )}
                {b.clv != null && (
                  <span className={cn("tabular text-xs", b.clv >= 0 ? "text-positive" : "text-negative-text")}>CLV {signedPct(b.clv)}</span>
                )}
                {b.actual_points != null && <span className="tabular text-xs">scored {b.actual_points}</span>}
                {b.profit != null && b.status !== "open" && <span className="tabular font-semibold">{units(b.profit)}</span>}
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[b.status])}>{b.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
