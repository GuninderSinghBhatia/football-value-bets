"use client";

import { SPORTS } from "@/config/sports";
import { useSetSport, useSport } from "@/lib/use-sport";
import { cn } from "@/lib/utils";

/** Row of sport icons that filters everything below it. Scrolls sideways on narrow screens instead of wrapping. */
export function SportSwitcher() {
  const sport = useSport();
  const setSport = useSetSport();
  return (
    <nav aria-label="Sport" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-4">
        {SPORTS.map((s) => {
          const active = s.id === sport;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSport(s.id)}
                aria-pressed={active}
                className="group flex w-16 flex-col items-center gap-1.5 transition-transform duration-200 active:scale-95"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 place-items-center rounded-full border text-lg transition-colors duration-200",
                    active
                      ? "border-accent-fill bg-accent-fill"
                      : "bg-surface grayscale group-hover:border-accent/60 group-hover:bg-surface-hover group-hover:grayscale-0",
                  )}
                >
                  {s.icon}
                </span>
                <span className={cn("text-xs font-medium", active ? "text-text" : "text-muted group-hover:text-text")}>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
