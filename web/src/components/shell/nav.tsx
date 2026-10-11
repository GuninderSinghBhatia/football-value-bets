"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, CalendarDays, Flame, LineChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Top picks", icon: Flame, match: (p: string) => p === "/" },
  { href: "/matches", label: "Matches", icon: CalendarDays, match: (p: string) => p.startsWith("/match") },
  { href: "/tracker", label: "Tracker", icon: Bookmark, match: (p: string) => p.startsWith("/tracker") },
  { href: "/performance", label: "Performance", icon: LineChart, match: (p: string) => p.startsWith("/performance") },
];
const SETTINGS = { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") };

/** Keeps the league filter when moving between pages. */
function useHref(href: string) {
  const params = useSearchParams();
  const league = params.get("league");
  return league && href !== "/settings" ? `${href}?league=${league}` : href;
}

function RailItem({ item }: { item: typeof SETTINGS }) {
  const pathname = usePathname();
  const href = useHref(item.href);
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "grid size-11 place-items-center rounded-xl transition-all duration-200 active:scale-90",
        active ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon className="size-5" />
    </Link>
  );
}

export function IconRail() {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-2 border-r bg-sidebar py-4 md:flex"
    >
      <Link href="/" aria-label="BetMind home" className="mb-4 grid size-10 place-items-center rounded-[10px] bg-accent-fill text-sm font-black text-on-accent">
        BM
      </Link>
      {ITEMS.map((item) => (
        <RailItem key={item.href} item={item} />
      ))}
      <div className="mt-auto">
        <RailItem item={SETTINGS} />
      </div>
    </nav>
  );
}

function TabItem({ item }: { item: typeof SETTINGS }) {
  const pathname = usePathname();
  const href = useHref(item.href);
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors duration-200", active ? "text-accent-text" : "text-muted")}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}

export function BottomTabs() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-sidebar md:hidden">
      {[...ITEMS, SETTINGS].map((item) => (
        <TabItem key={item.href} item={item} />
      ))}
    </nav>
  );
}
