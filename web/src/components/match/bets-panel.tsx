"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SaveButton } from "@/components/tracker/save-button";
import { useSetParam } from "@/lib/use-set-param";
import { Card, Chip, ConfidenceBadge, EmptyState, EvText, ValuePill } from "@/components/ui/primitives";
import { marketLabel, odds, pct, selectionLabel, signedPct } from "@/lib/format";
import type { BetPrediction, Bookmaker, Match } from "@/lib/types";
import { cn } from "@/lib/utils";

const BEST = "best";
const MARKET_ORDER = ["1X2", "DC", "OU_2.5", "BTTS", "CARDS_4.5", "CORNERS_9.5"];

/** Price for one selection at the chosen book ("best" = highest price across books). Model % never changes. */
function priced(p: BetPrediction, book: string) {
  const price = book === BEST ? { bookmaker: p.bookmaker, odds: p.odds } : p.prices?.find((x) => x.bookmaker === book);
  if (!price) return { ...p, available: false as const };
  return {
    ...p,
    available: true as const,
    odds: price.odds,
    bookmaker: price.bookmaker,
    impliedProb: 1 / price.odds,
    ev: p.modelProb * price.odds - 1,
  };
}

function BookBadge({ book }: { book?: Bookmaker }) {
  if (!book) return null;
  return (
    <span
      title={book.name}
      aria-label={book.name}
      className="inline-grid h-5 min-w-6 place-items-center rounded-md bg-surface-2 px-1 text-[10px] font-bold text-muted"
    >
      {book.short}
    </span>
  );
}

export function BetsPanel({
  predictions,
  match,
  bookmakers,
}: {
  predictions: BetPrediction[];
  match: Match;
  bookmakers: Bookmaker[];
}) {
  // Kept in the URL so a chosen view can be shared.
  const params = useSearchParams();
  const setParam = useSetParam();
  const bookById = new Map(bookmakers.map((b) => [b.id, b]));
  const liveBooks = bookmakers.filter((b) => b.live);
  const offline = bookmakers.filter((b) => !b.live);
  const book = liveBooks.some((b) => b.id === params.get("book")) ? params.get("book")! : BEST;
  const view = params.get("view") === "compare" ? "compare" : "table";
  const setBook = (id: string) => setParam("book", id === BEST ? null : id);
  const setView = (v: "table" | "compare") => setParam("view", v === "table" ? null : v);

  return (
    <Card
      title="All bets for this match"
      action={
        <div className="flex gap-2" role="group" aria-label="View">
          <Chip active={view === "table"} onClick={() => setView("table")}>
            Table
          </Chip>
          <Chip active={view === "compare"} onClick={() => setView("compare")}>
            Compare all
          </Chip>
        </div>
      }
    >
      {view === "table" && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Bookmaker">
          <Chip active={book === BEST} onClick={() => setBook(BEST)}>
            Best odds
          </Chip>
          {liveBooks.map((b) => (
            <Chip key={b.id} active={book === b.id} onClick={() => setBook(b.id)}>
              {b.name}
            </Chip>
          ))}
          {offline.map((b) => (
            <span
              key={b.id}
              title="No odds feed connected for this bookmaker yet"
              className="cursor-not-allowed rounded-xl border border-dashed px-3 py-1.5 text-sm text-muted/70"
            >
              {b.name}
            </span>
          ))}
        </div>
      )}

      {predictions.length === 0 ? (
        <EmptyState
          title="No odds for this match yet"
          hint={match.status === "finished" ? "Odds are no longer listed after full time." : "Prices usually appear a few days before kickoff."}
        />
      ) : view === "table" ? (
        <BookTable predictions={predictions} match={match} book={book} bookById={bookById} />
      ) : (
        <CompareMatrix predictions={predictions} match={match} bookmakers={liveBooks} />
      )}

      <p className="mt-4 text-xs text-muted">
        Real odds: {liveBooks.map((b) => b.name).join(", ")} (via{" "}
        {liveBooks.some((b) => b.id === "draftkings") ? "ESPN" : "The Odds API"}).
        {offline.length > 0 && ` ${offline.map((b) => b.name).join(", ")}: no feed connected yet.`} Model % is a placeholder (85%
        de-vigged consensus market + 15% league-goals baseline; market only for cross-league games), not BetMind&apos;s model. EV =
        model probability × best odds − 1.
      </p>
    </Card>
  );
}

type PricedRow = ReturnType<typeof priced>;

/** One bet row: bookmark to save, and an expand panel with the snapshot and a "Save pick" button. */
function BetRow({
  r,
  first,
  market,
  match,
  book,
  bookById,
}: {
  r: PricedRow;
  first: boolean;
  market: string;
  match: Match;
  book: string;
  bookById: Map<string, Bookmaker>;
}) {
  const [open, setOpen] = useState(false);
  const value = r.available && r.ev > 0;
  const canSave = r.available && match.status === "scheduled";
  return (
    <>
      <tr className={cn(value && "bg-positive/5", !r.available && "text-muted")}>
        <td className={cn("border-l-[3px] py-2.5 pl-3 text-muted", value ? "border-positive" : "border-transparent")}>
          {first ? marketLabel(market) : ""}
        </td>
        <td className="py-2.5 font-medium">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-2 text-left hover:text-accent-text"
          >
            <ChevronRight className={cn("size-3.5 shrink-0 text-muted transition-transform duration-300", open && "rotate-90")} />
            {selectionLabel(r.market, r.selection, match.home.name, match.away.name)}
            {value && <ValuePill />}
          </button>
        </td>
        {r.available ? (
          <>
            <td className="py-2.5 text-right">
              <span className="inline-flex items-center justify-end gap-1.5">
                {book === BEST && <BookBadge book={bookById.get(r.bookmaker ?? "")} />}
                <span className="tabular font-semibold">{odds(r.odds)}</span>
              </span>
            </td>
            <td className="tabular py-2.5 text-right text-muted">{pct(r.impliedProb)}</td>
            <td className="tabular py-2.5 text-right">{pct(r.modelProb)}</td>
            <td className="py-2.5 text-right">
              <EvText ev={r.ev} />
            </td>
          </>
        ) : (
          <>
            <td className="py-2.5 text-right" colSpan={2}>
              Not offered
            </td>
            <td className="tabular py-2.5 text-right">{pct(r.modelProb)}</td>
            <td className="py-2.5 text-right">–</td>
          </>
        )}
        <td className="py-2.5 text-right">
          <ConfidenceBadge level={r.confidence} />
        </td>
        <td className="py-1.5 pl-2 text-right">{canSave && <SaveButton pick={r} match={match} />}</td>
      </tr>
      {open && (
        <tr className="animate-fade-in">
          <td colSpan={8} className="pb-3 pl-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <p className="max-w-md text-xs text-muted">
                Saving records this pick with a snapshot of the odds ({r.available ? odds(r.odds) : "–"}), model {pct(r.modelProb)} and EV now.
                BetMind checks the result after full time. No bet is placed.
              </p>
              {canSave ? (
                <SaveButton pick={r} match={match} variant="button" />
              ) : (
                <span className="text-xs text-muted">{r.available ? "Match has started: saving is closed." : "No price to save."}</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BookTable({
  predictions,
  match,
  book,
  bookById,
}: {
  predictions: BetPrediction[];
  match: Match;
  book: string;
  bookById: Map<string, Bookmaker>;
}) {
  const rows = predictions.map((p) => priced(p, book));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.market, [...(groups.get(r.market) ?? []), r]);

  // Rows by EV (best first, unavailable last); groups by their best available EV.
  const bestEv = (list: typeof rows) => Math.max(...list.filter((r) => r.available).map((r) => r.ev), -Infinity);
  const sorted = [...groups.entries()]
    .map(([market, list]) => [market, [...list].sort((a, b) => (a.available === b.available ? b.ev - a.ev : a.available ? -1 : 1))] as const)
    .sort((a, b) => bestEv(b[1]) - bestEv(a[1]));
  const missing = rows.filter((r) => !r.available).length;

  return (
    <>
      <div className="relative -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="pb-2 font-normal">Market</th>
              <th className="pb-2 font-normal">Selection</th>
              <th className="pb-2 text-right font-normal">Odds</th>
              <th className="pb-2 text-right font-normal">Implied</th>
              <th className="pb-2 text-right font-normal">Model</th>
              <th className="pb-2 text-right font-normal">EV</th>
              <th className="pb-2 text-right font-normal">Confidence</th>
              <th className="pb-2 font-normal">
                <span className="sr-only">Save</span>
              </th>
            </tr>
          </thead>
          {sorted.map(([market, list]) => (
            <tbody key={`${market}-${book}`} className="stagger-fade border-t">
              {list.map((r, i) => (
                <BetRow key={r.selection} r={r} first={i === 0} market={market} match={match} book={book} bookById={bookById} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {book !== BEST && missing > 0 && (
        <p className="mt-3 text-xs text-muted">
          {bookById.get(book)?.name} doesn&apos;t offer {missing} of these selections.
        </p>
      )}
    </>
  );
}

function CompareMatrix({
  predictions,
  match,
  bookmakers,
}: {
  predictions: BetPrediction[];
  match: Match;
  bookmakers: Bookmaker[];
}) {
  const groups = MARKET_ORDER.map((m) => [m, predictions.filter((p) => p.market === m)] as const).filter(([, l]) => l.length);

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="pb-2 font-normal">Selection</th>
            <th className="pb-2 text-right font-normal">Model</th>
            {bookmakers.map((b) => (
              <th key={b.id} className="pb-2 text-center font-normal">
                {b.name}
              </th>
            ))}
            <th className="pb-2 text-right font-normal">Best EV</th>
          </tr>
        </thead>
        {groups.map(([market, list]) => (
          <tbody key={market} className="stagger-fade border-t">
            <tr>
              <th colSpan={bookmakers.length + 3} className="pt-3 pb-1 text-left text-xs font-medium text-muted">
                {marketLabel(market)}
              </th>
            </tr>
            {list.map((p) => (
              <tr key={p.selection}>
                <td className="py-2 font-medium">{selectionLabel(p.market, p.selection, match.home.name, match.away.name)}</td>
                <td className="tabular py-2 text-right">{pct(p.modelProb)}</td>
                {bookmakers.map((b) => {
                  const price = p.prices?.find((x) => x.bookmaker === b.id);
                  const isBest = price && price.odds === p.odds;
                  return (
                    <td key={b.id} className="py-2 text-center">
                      {price ? (
                        <span
                          className={cn(
                            "tabular inline-block min-w-12 rounded-lg px-1.5 py-1",
                            isBest ? "bg-accent/15 font-bold ring-1 ring-accent" : "text-muted",
                          )}
                        >
                          {odds(price.odds)}
                          {isBest && <span className="sr-only"> (best price)</span>}
                        </span>
                      ) : (
                        <span className="text-muted" aria-label="Not offered">
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 text-right">
                  <span className={cn("tabular font-semibold", p.ev > 0 ? "text-positive" : "text-negative-text")}>{signedPct(p.ev)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
