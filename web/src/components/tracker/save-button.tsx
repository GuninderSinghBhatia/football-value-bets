"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { IconButton } from "@/components/ui/primitives";
import { useMounted } from "@/components/ui/client";
import { BOOK_NAMES, marketLabel, odds, pct, selectionLabel, signedPct } from "@/lib/format";
import type { BetPrediction, Match } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePicks } from "./picks-context";

const TAG_SUGGESTIONS = ["value", "long-shot", "derby", "favourite", "goals", "hunch"];

type Props = {
  pick: BetPrediction;
  match: Pick<Match, "id" | "home" | "away">;
  /** icon: bookmark only. button: "Save pick" button. light: bookmark for the red hero banner. */
  variant?: "icon" | "button" | "light";
};

/** Bookmark that opens the save modal; filled once the pick is saved. Never places a bet. */
export function SaveButton({ pick, match, variant = "icon" }: Props) {
  const { isSaved } = usePicks();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // Saved state is client-only (picks load after hydration), so render the unsaved state until mounted.
  const mounted = useMounted();
  const saved = mounted && isSaved({ matchId: match.id, market: pick.market, selection: pick.selection });
  const label = selectionLabel(pick.market, pick.selection, match.home.name, match.away.name);

  const onClick = (e: React.MouseEvent) => {
    // These buttons sit inside clickable rows and links.
    e.preventDefault();
    e.stopPropagation();
    if (saved) toast("Already saved", "info");
    else setOpen(true);
  };

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95",
            saved ? "bg-surface-2 text-muted" : "bg-accent-fill text-on-accent hover:bg-accent-dim",
          )}
        >
          <Bookmark className={cn("size-4", saved && "fill-current")} />
          {saved ? "Saved" : "Save pick"}
        </button>
      ) : (
        <IconButton
          label={saved ? `${label} saved` : `Save ${label}`}
          aria-pressed={saved}
          onClick={onClick}
          className={cn(
            variant === "light" ? "bg-on-accent/15 text-on-accent hover:bg-on-accent/25 hover:text-on-accent" : "",
            saved && variant !== "light" && "text-accent-text",
          )}
        >
          <Bookmark className={cn("size-4 transition-transform duration-200", saved && "scale-110 fill-current")} />
        </IconButton>
      )}
      {open && createPortal(<SaveModal pick={pick} match={match} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SaveModal({ pick, match, onClose }: { pick: BetPrediction; match: Props["match"]; onClose: () => void }) {
  const { save } = usePicks();
  const [stake, setStake] = useState("1");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>(pick.ev > 0 ? ["value"] : []);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const stakeRef = useRef<HTMLInputElement>(null);
  const bookmaker = pick.bookmaker ?? "draftkings";

  useEffect(() => {
    stakeRef.current?.select();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const addCustom = () => {
    const t = custom.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setCustom("");
  };
  const stakeNum = Number(stake);
  const valid = stakeNum > 0 && stakeNum <= 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const result = await save({
      matchId: match.id,
      market: pick.market,
      selection: pick.selection,
      bookmaker,
      oddsAtSave: pick.odds,
      modelProb: pick.modelProb,
      impliedProb: pick.impliedProb,
      ev: pick.ev,
      confidence: pick.confidence,
      stake: stakeNum,
      note: note || undefined,
      tags,
    });
    setBusy(false);
    if (result !== "error") onClose();
  };

  return (
    // React bubbles portal events to the component that opened it (often a row link), so stop them here.
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-title"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md animate-scale-in rounded-card border bg-surface p-5 shadow-[0_24px_60px_rgb(0_0_0/0.5)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="save-title" className="text-lg font-semibold">
              Save pick
            </h2>
            <p className="text-sm text-muted">
              {match.home.name} vs {match.away.name}
            </p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="mb-4 rounded-xl bg-surface-2 p-3">
          <div className="font-medium">{selectionLabel(pick.market, pick.selection, match.home.name, match.away.name)}</div>
          <div className="text-xs text-muted">{marketLabel(pick.market)}</div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-sm">
            {[
              ["Odds", odds(pick.odds)],
              ["Model", pct(pick.modelProb)],
              ["Implied", pct(pick.impliedProb)],
              ["EV", signedPct(pick.ev)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="tabular font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Stake (units)
            <input
              ref={stakeRef}
              type="number"
              inputMode="decimal"
              min={0.1}
              max={100}
              step="any"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              aria-invalid={!valid}
              className="h-10 rounded-xl border border-transparent bg-surface-2 px-3 text-sm text-text focus:border-accent/70"
            />
          </label>
          <div className="flex flex-col gap-1.5 text-xs text-muted">
            Bookmaker
            <span className="flex h-10 items-center rounded-xl bg-surface-2 px-3 text-sm text-text">
              {BOOK_NAMES[bookmaker] ?? bookmaker} @ {odds(pick.odds)}
            </span>
          </div>
        </div>

        <label className="mt-3 flex flex-col gap-1.5 text-xs text-muted">
          Note (why you like it)
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. their keeper is injured"
            className="resize-y rounded-xl border border-transparent bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent/70"
          />
        </label>

        <div className="mt-3">
          <div className="mb-1.5 text-xs text-muted">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...TAG_SUGGESTIONS, ...tags])].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tags.includes(t)}
                onClick={() => toggleTag(t)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 active:scale-95",
                  tags.includes(t) ? "bg-accent/15 text-accent-text ring-1 ring-accent/60" : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                #{t}
              </button>
            ))}
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              onBlur={addCustom}
              placeholder="+ tag"
              aria-label="Add a tag"
              className="w-20 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text placeholder:text-muted"
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">This only records the prediction. BetMind never places bets.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="inline-flex items-center gap-2 rounded-[10px] bg-accent-fill px-4 py-2 text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-dim disabled:opacity-50"
          >
            <Bookmark className="size-4" /> {busy ? "Saving…" : "Save pick"}
          </button>
        </div>
      </form>
    </div>
  );
}
