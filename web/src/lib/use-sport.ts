"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_SPORT, parseSport, sportOfMatchId, type SportId } from "@/config/sports";

/** The selected sport lives in the URL (`?sport=tennis`; absent = football), so refresh and shared links keep it. */
export function useSport(): SportId {
  const param = useSearchParams().get("sport");
  const pathname = usePathname();
  // Match pages carry the sport in the id instead ("/match/tennis-123").
  if (!param && pathname.startsWith("/match/")) return sportOfMatchId(pathname.slice("/match/".length));
  return parseSport(param);
}

/** Switches sport on the current page. Clears the league filter, since leagues differ per sport. */
export function useSetSport() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (sport: SportId) => {
    const next = new URLSearchParams(params.toString());
    next.delete("league");
    if (sport === DEFAULT_SPORT) next.delete("sport");
    else next.set("sport", sport);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}
