"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Updates one URL search param, keeping the others. */
export function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

/** Pages that list matches or picks and filter them by `?league=`. */
export const LEAGUE_FILTER_PAGES = (pathname: string) =>
  pathname === "/" || pathname.startsWith("/matches") || pathname.startsWith("/performance");
