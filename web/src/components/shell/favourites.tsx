"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { Crest } from "@/components/ui/client";
import { LEAGUE_FILTER_PAGES, useSetParam } from "@/lib/use-set-param";
import { cn } from "@/lib/utils";
import type { League, TeamProfile } from "@/lib/types";

type Favourites = {
  leagues: League[];
  teams: TeamProfile[];
  favLeagues: string[];
  favClubs: string[];
  toggleLeague: (id: string) => void;
  toggleClub: (id: string) => void;
};

const FavouritesContext = createContext<Favourites | null>(null);
const STORAGE_KEY = "betmind-favourites-v2"; // v2: team ids changed to ESPN ids
// Team ids are ESPN ids (86 = Real Madrid, 83 = Barcelona).
const DEFAULTS = { leagues: ["PD"], clubs: ["86", "83"] };

export function FavouritesProvider({
  leagues,
  teams,
  children,
}: {
  leagues: League[];
  teams: TeamProfile[];
  children: React.ReactNode;
}) {
  const [favLeagues, setFavLeagues] = useState(DEFAULTS.leagues);
  const [favClubs, setFavClubs] = useState(DEFAULTS.clubs);

  // Favourites are a per-viewer convenience, so browser storage is enough. It may be unavailable.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        setFavLeagues(saved.leagues ?? DEFAULTS.leagues);
        setFavClubs(saved.clubs ?? DEFAULTS.clubs);
      }
    } catch {}
  }, []);

  const save = (next: { leagues: string[]; clubs: string[] }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const toggleLeague = useCallback(
    (id: string) =>
      setFavLeagues((prev) => {
        const next = toggle(prev, id);
        save({ leagues: next, clubs: favClubs });
        return next;
      }),
    [favClubs],
  );
  const toggleClub = useCallback(
    (id: string) =>
      setFavClubs((prev) => {
        const next = toggle(prev, id);
        save({ leagues: favLeagues, clubs: next });
        return next;
      }),
    [favLeagues],
  );

  return (
    <FavouritesContext.Provider value={{ leagues, teams, favLeagues, favClubs, toggleLeague, toggleClub }}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used inside FavouritesProvider");
  return ctx;
}

function HeartToggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${on ? "Remove" : "Add"} ${label} ${on ? "from" : "to"} favourites`}
      className="ml-auto grid size-8 place-items-center rounded-lg transition-all duration-200 hover:bg-surface-2 active:scale-75"
    >
      <Heart className={cn("size-4 transition-colors duration-300", on ? "fill-accent text-accent" : "text-muted")} />
    </button>
  );
}

export function FavouritesPanel() {
  const { leagues, teams, favLeagues, favClubs, toggleLeague, toggleClub } = useFavourites();
  const [showAllClubs, setShowAllClubs] = useState(false);
  const clubs = showAllClubs ? teams : teams.filter((t) => favClubs.includes(t.id));

  // Clicking a league filters the list on this page, or opens Matches for that league on other pages.
  const router = useRouter();
  const pathname = usePathname();
  const activeLeague = useSearchParams().get("league");
  const setParam = useSetParam();
  const selectLeague = (id: string) => {
    const next = activeLeague === id ? null : id;
    if (LEAGUE_FILTER_PAGES(pathname)) setParam("league", next);
    else router.push(next ? `/matches?league=${next}` : "/matches");
  };

  return (
    <div className="space-y-4">
      <Card title="Favourite leagues">
        <ul className="stagger space-y-1">
          {leagues.map((l) => (
            <li
              key={l.id}
              className={cn(
                "flex items-center gap-1 rounded-xl pr-1 transition-colors duration-200",
                activeLeague === l.id ? "bg-accent/10 ring-1 ring-accent/60" : "hover:bg-surface-2",
              )}
            >
              <button
                type="button"
                onClick={() => selectLeague(l.id)}
                aria-pressed={activeLeague === l.id}
                title={activeLeague === l.id ? "Show all leagues" : `Show ${l.name} matches`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition-transform duration-200 active:scale-[0.98]"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full bg-text p-1.5 transition-shadow duration-200",
                    activeLeague === l.id && "ring-1 ring-accent",
                  )}
                >
                  <Crest src={l.logoUrl} name={l.name} size={22} />
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-medium", activeLeague === l.id && "text-accent-text")}>
                    {l.name}
                  </span>
                  <span className="block text-xs text-muted">{l.country}</span>
                </span>
              </button>
              <HeartToggle on={favLeagues.includes(l.id)} label={l.name} onClick={() => toggleLeague(l.id)} />
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Favourite clubs"
        action={
          <button type="button" onClick={() => setShowAllClubs((v) => !v)} className="text-xs text-muted hover:text-text">
            {showAllClubs ? "Done" : "Edit"}
          </button>
        }
      >
        {clubs.length === 0 ? (
          <p className="text-sm text-muted">No favourite clubs yet. Select Edit to add some.</p>
        ) : (
          <ul className={cn("space-y-1", showAllClubs && "max-h-80 overflow-y-auto pr-1")}>
            {clubs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-1 py-1">
                <Crest src={t.crestUrl} name={t.name} size={26} />
                <span className="truncate text-sm">{t.name}</span>
                <HeartToggle on={favClubs.includes(t.id)} label={t.name} onClick={() => toggleClub(t.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
