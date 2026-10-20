"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { LocalTime } from "@/components/ui/client";
import { Card, EmptyState, EvText, ValuePill } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/select";
import { pct } from "@/lib/format";
import { american, bestSide, type NbaGame, type NbaProp } from "@/lib/nba";
import { cn } from "@/lib/utils";

type Sort = "ev" | "line" | "player";
type Show = "all" | "picks";

const sorters: Record<Sort, (a: NbaProp, b: NbaProp) => number> = {
  ev: (a, b) => (bestSide(b)?.ev ?? -9) - (bestSide(a)?.ev ?? -9),
  line: (a, b) => b.line - a.line,
  player: (a, b) => a.player.localeCompare(b.player),
};

export function TonightView({ games, evThreshold }: { games: NbaGame[]; evThreshold: number }) {
  const [sort, setSort] = useState<Sort>("ev");
  const [show, setShow] = useState<Show>("all");
  const withProps = games.filter((g) => g.props.length > 0);
  const waiting = games.filter((g) => g.props.length === 0 && g.state === "pre");

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Segmented
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={[
            { value: "ev", label: "EV" },
            { value: "line", label: "Line" },
            { value: "player", label: "Player" },
          ]}
        />
        <Segmented
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All props" },
            { value: "picks", label: `Picks (EV > ${Math.round(evThreshold * 100)}%)` },
          ]}
        />
      </div>

      {withProps.length === 0 && (
        <Card>
          <EmptyState
            title="No points lines yet"
            hint="DraftKings posts player points lines on game day. Run nba/scripts/run_pipeline.py to refresh."
          />
        </Card>
      )}

      {withProps.map((g) => {
        const props = g.props.filter((p) => show === "all" || p.pick).sort(sorters[sort]);
        return (
          <Card
            key={g.event_id}
            title={
              <span>
                {g.away} @ {g.home}
                <span className="ml-2 font-normal text-muted">
                  {g.state === "pre" ? <LocalTime iso={g.start_time} format="datetime" /> : `${g.away_score}–${g.home_score} · ${g.status}`}
                </span>
              </span>
            }
            action={<span className="text-xs text-muted">{g.props.filter((p) => p.pick).length} picks</span>}
          >
            {props.length === 0 ? (
              <EmptyState title="No picks in this game" />
            ) : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium sm:pl-5">Player</th>
                      <th className="px-2 py-2 text-right font-medium">Line</th>
                      <th className="px-2 py-2 text-right font-medium">Over / Under</th>
                      <th className="px-2 py-2 text-right font-medium">Predicted</th>
                      <th className="px-2 py-2 text-right font-medium">P(over)</th>
                      <th className="px-2 py-2 text-right font-medium">Book P(over)</th>
                      <th className="px-2 py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          EV {sort === "ev" && <ArrowDown className="size-3" aria-label="sorted" />}
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right font-medium sm:pr-5">Pick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.map((p) => (
                      <PropRow key={p.key} p={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {waiting.length > 0 && (
        <Card title="Lines not posted yet">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {waiting.map((g) => (
              <li key={g.event_id} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span>
                  {g.away} @ {g.home}
                </span>
                <span className="text-muted">
                  <LocalTime iso={g.start_time} format="datetime" />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function PropRow({ p }: { p: NbaProp }) {
  const best = bestSide(p);
  const predicted = p.predicted_points != null;
  return (
    <tr className={cn("border-b last:border-0", p.pick && "bg-positive/5")}>
      <td className="px-4 py-2.5 sm:pl-5">
        {p.player_id != null ? (
          <Link href={`/nba/player/${p.player_id}?game=${p.event_id}`} className="font-medium text-info hover:underline">
            {p.player}
          </Link>
        ) : (
          <span className="font-medium">{p.player}</span>
        )}
        <div className="text-xs text-muted">
          {p.team} vs {p.opponent}
          {p.injury_status && <span className="ml-1 text-warning">· {p.injury_status}</span>}
          {p.season_avg_filled && <span className="ml-1">· 1st game</span>}
        </div>
      </td>
      <td className="tabular px-2 py-2.5 text-right font-semibold">
        {p.line}
        {p.open_line != null && p.open_line !== p.line && <div className="text-xs font-normal text-muted">opened {p.open_line}</div>}
      </td>
      <td className="tabular px-2 py-2.5 text-right">
        {american(p.over_odds)} / {american(p.under_odds)}
      </td>
      <td className="tabular px-2 py-2.5 text-right">
        {predicted ? p.predicted_points!.toFixed(1) : <span className="text-xs text-muted">{p.skip_reason ?? "–"}</span>}
        {predicted && p.sd != null && <div className="text-xs text-muted">± {p.sd.toFixed(1)}</div>}
      </td>
      <td className="tabular px-2 py-2.5 text-right">{p.p_over != null ? pct(p.p_over) : "–"}</td>
      <td className="tabular px-2 py-2.5 text-right text-muted">{p.no_vig_p_over != null ? pct(p.no_vig_p_over) : "–"}</td>
      <td className="px-2 py-2.5 text-right">
        {best ? (
          <>
            <EvText ev={best.ev} />
            <div className="text-xs text-muted capitalize">{best.side}</div>
          </>
        ) : (
          "–"
        )}
      </td>
      <td className="px-4 py-2.5 text-right sm:pr-5">
        {p.pick ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold capitalize">
              {p.pick} {p.line}
            </span>
            <ValuePill />
          </span>
        ) : (
          <span className="text-muted">No bet</span>
        )}
      </td>
    </tr>
  );
}
