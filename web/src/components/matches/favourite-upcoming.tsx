"use client";

import Link from "next/link";
import { useFavourites } from "@/components/shell/favourites";
import { Crest, LocalTime } from "@/components/ui/client";
import { Card } from "@/components/ui/primitives";
import type { Match } from "@/lib/types";

export function FavouriteUpcoming({ matches }: { matches: Match[] }) {
  const { favLeagues } = useFavourites();
  const upcoming = matches
    .filter((m) => favLeagues.includes(m.leagueId) && (m.status === "scheduled" || m.status === "live"))
    .slice(0, 5);

  return (
    <Card title="Upcoming in your favourite leagues">
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">Add a favourite league with the heart icon to see its next matches here.</p>
      ) : (
        <ul className="stagger space-y-2">
          {upcoming.map((m) => (
            <li key={m.id}>
              <Link href={`/match/${m.id}`} className="pressable block rounded-xl bg-surface-2 p-3 hover:bg-surface-2/70">
                <div className="mb-2 text-xs text-muted">
                  <LocalTime iso={m.kickoff} format="datetime" />
                </div>
                {[m.home, m.away].map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <Crest src={t.crestUrl} name={t.name} size={18} />
                    <span className="truncate">{t.name}</span>
                  </div>
                ))}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
