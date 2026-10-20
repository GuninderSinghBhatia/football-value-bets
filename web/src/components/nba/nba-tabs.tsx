"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/nba", label: "Tonight", match: (p: string) => p === "/nba" || p.startsWith("/nba/player") },
  { href: "/nba/bets", label: "Paper trades", match: (p: string) => p.startsWith("/nba/bets") },
  { href: "/nba/performance", label: "Performance", match: (p: string) => p.startsWith("/nba/performance") },
];

/** Section header for NBA props: title, paper-trading note and sub-page tabs. */
export function NbaHeader({ generatedAt }: { generatedAt?: string | null }) {
  const pathname = usePathname();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em]">🏀 NBA player points</h1>
          <p className="text-sm text-muted">
            Model nba-points-v1 vs DraftKings lines. Paper trading only, 1-unit flat stakes.
          </p>
        </div>
        {generatedAt && (
          <span className="text-xs text-muted">
            Updated <time dateTime={generatedAt}>{generatedAt.replace("T", " ").slice(0, 16)} UTC</time>
          </span>
        )}
      </div>
      <nav aria-label="NBA props" className="flex gap-2">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                active ? "border-line-strong bg-line-strong text-text" : "border-transparent bg-surface-2 text-muted hover:text-text",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
