"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// X (Twitter) accounts the viewer follows on the News page. A per-viewer preference, so browser storage is enough.

export type XAccount = { handle: string; label?: string };

const STORAGE_KEY = "betmind-x-accounts-v1";

/** Shown on first visit, so the page isn't empty. */
const DEFAULTS: XAccount[] = [
  { handle: "FabrizioRomano", label: "Transfers" },
  { handle: "BenDinnery", label: "Injuries" },
];

/** Quick-add ideas: team-news reporters and the official league accounts we cover. */
export const SUGGESTED: XAccount[] = [
  { handle: "FabrizioRomano", label: "Transfers" },
  { handle: "David_Ornstein", label: "Team news" },
  { handle: "BenDinnery", label: "Injuries" },
  { handle: "premierleague", label: "Premier League" },
  { handle: "LaLigaEN", label: "LaLiga" },
  { handle: "SerieA_EN", label: "Serie A" },
  { handle: "Bundesliga_EN", label: "Bundesliga" },
  { handle: "Ligue1_ENG", label: "Ligue 1" },
  { handle: "ChampionsLeague", label: "Champions League" },
];

/** "@Name", "x.com/Name", "https://twitter.com/Name/status/1" → "Name"; null when it isn't a valid handle. */
export function parseHandle(input: string): string | null {
  const s = input.trim();
  const url = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([^/?#\s]+)/i.exec(s);
  const handle = url ? url[1] : s.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

type Ctx = {
  accounts: XAccount[];
  add: (a: XAccount) => boolean;
  remove: (handle: string) => void;
  has: (handle: string) => boolean;
};

const XAccountsContext = createContext<Ctx | null>(null);

export function XAccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<XAccount[]>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved)) setAccounts(saved);
    } catch {}
  }, []);

  const update = useCallback((fn: (prev: XAccount[]) => XAccount[]) => {
    setAccounts((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const has = useCallback((handle: string) => accounts.some((a) => same(a.handle, handle)), [accounts]);

  const add = useCallback(
    (a: XAccount) => {
      if (has(a.handle)) return false;
      update((prev) => [...prev, { handle: a.handle, label: a.label?.trim() || undefined }]);
      return true;
    },
    [has, update],
  );

  const remove = useCallback((handle: string) => update((prev) => prev.filter((a) => !same(a.handle, handle))), [update]);

  return <XAccountsContext.Provider value={{ accounts, add, remove, has }}>{children}</XAccountsContext.Provider>;
}

export function useXAccounts() {
  const ctx = useContext(XAccountsContext);
  if (!ctx) throw new Error("useXAccounts must be used inside XAccountsProvider");
  return ctx;
}
