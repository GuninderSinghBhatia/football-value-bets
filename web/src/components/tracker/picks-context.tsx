"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { shortSelection } from "@/lib/format";
import type { SavePickInput, TrackedPick } from "@/lib/types";

type SaveResult = "saved" | "duplicate" | "error";

type Picks = {
  picks: TrackedPick[];
  loaded: boolean;
  isSaved: (p: { matchId: string; market: string; selection: string }) => boolean;
  save: (input: SavePickInput) => Promise<SaveResult>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  /** Picks settled since the user last looked at the Settled tab. */
  unseen: number;
  markSeen: () => void;
};

const PicksContext = createContext<Picks | null>(null);
const SEEN_KEY = "betmind-seen-settled";
const POLL_MS = 2 * 60_000;
const key = (p: { matchId: string; market: string; selection: string }) => `${p.matchId}|${p.market}|${p.selection}`;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function PicksProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [picks, setPicks] = useState<TrackedPick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const previous = useRef<Map<string, string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/picks", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as TrackedPick[];
      // Announce picks that settled since the last check (the "your pick won" notification).
      if (previous.current) {
        for (const p of next) {
          const before = previous.current.get(p.id);
          if (before === "pending" && p.status !== "pending") {
            const label = `${shortSelection(p.market, p.selection)} in ${p.match.home.name}–${p.match.away.name}`;
            toast(
              p.status === "won" ? `Your pick ${label} won ✅` : p.status === "lost" ? `Your pick ${label} lost ❌` : `Your pick ${label} was voided ↩`,
              p.status === "won" ? "success" : p.status === "lost" ? "error" : "info",
            );
          }
        }
      }
      previous.current = new Map(next.map((p) => [p.id, p.status]));
      setPicks(next);
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    setSeen(readSeen());
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const save = useCallback(
    async (input: SavePickInput): Promise<SaveResult> => {
      const res = await fetch("/api/picks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (res.status === 409) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        toast(error || "Already saved", "info");
        return "duplicate";
      }
      if (!res.ok) {
        toast("Couldn't save this pick", "error");
        return "error";
      }
      toast("Pick saved ✓");
      await refresh();
      return "saved";
    },
    [refresh, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/picks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }));
        toast(error || "Couldn't remove this pick", "error");
        return false;
      }
      toast("Pick removed", "info");
      await refresh();
      return true;
    },
    [refresh, toast],
  );

  const settledIds = picks.filter((p) => p.status !== "pending").map((p) => p.id);
  const unseen = settledIds.filter((id) => !seen.includes(id)).length;
  const markSeen = useCallback(() => {
    setSeen(settledIds);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(settledIds));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settledIds is derived from picks
  }, [picks]);

  const savedKeys = new Set(picks.map(key));
  return (
    <PicksContext.Provider
      value={{ picks, loaded, isSaved: (p) => savedKeys.has(key(p)), save, remove, refresh, unseen, markSeen }}
    >
      {children}
    </PicksContext.Provider>
  );
}

export function usePicks() {
  const ctx = useContext(PicksContext);
  if (!ctx) throw new Error("usePicks must be used inside PicksProvider");
  return ctx;
}
