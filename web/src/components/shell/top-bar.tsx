"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui/primitives";
import { FavouritesPanel } from "./favourites";
import { usePicks } from "@/components/tracker/picks-context";
import { useMounted } from "@/components/ui/client";
import { useSetParam } from "@/lib/use-set-param";

function SearchBox() {
  const params = useSearchParams();
  const setParam = useSetParam();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      if (value !== (params.get("q") ?? "")) setParam("q", value.trim() || null);
    }, 250);
    return () => clearTimeout(id);
  }, [value, params, setParam]);

  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 sm:max-w-72">
      <Search className="size-4 shrink-0 text-muted" />
      <span className="sr-only">Search teams</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search teams…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
    </label>
  );
}

/** Shows how many saved picks settled since the user last opened the Settled tab. */
function BellButton() {
  // Picks load after hydration and this chunk may hydrate later, so only show the count once mounted.
  const mounted = useMounted();
  const { unseen: count } = usePicks();
  const unseen = mounted ? count : 0;
  return (
    <Link
      href="/tracker?tab=settled"
      aria-label={unseen ? `${unseen} saved pick${unseen > 1 ? "s" : ""} settled` : "Notifications"}
      className="relative grid size-9 place-items-center rounded-[10px] bg-surface-2 text-muted transition-all duration-200 hover:text-text active:scale-90"
    >
      <Bell className="size-4" />
      {unseen > 0 && (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 animate-scale-in place-items-center rounded-full bg-accent-fill px-1 text-[10px] font-bold text-on-accent">
          {unseen}
        </span>
      )}
    </Link>
  );
}

export function TopBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => setDrawerOpen(false), [pathname, search]);

  return (
    <header className="sticky top-0 z-20 border-b bg-bg/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <IconButton label="Favourites and filters" className="min-[900px]:hidden" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal className="size-4" />
        </IconButton>
        <SearchBox />
        <div className="ml-auto flex gap-2">
          <BellButton />
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid size-9 place-items-center rounded-[10px] bg-surface-2 text-muted hover:text-text"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 min-[900px]:hidden" role="dialog" aria-modal="true" aria-label="Favourites">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 animate-fade-in bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] animate-slide-in-left overflow-y-auto bg-bg p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Favourites</span>
              <IconButton label="Close" onClick={() => setDrawerOpen(false)}>
                <X className="size-4" />
              </IconButton>
            </div>
            <FavouritesPanel />
          </div>
        </div>
      )}
    </header>
  );
}
