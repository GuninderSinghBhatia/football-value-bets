"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Team crest or league logo, falling back to initials if the image is missing or fails. */
export function Crest({ src, name, size = 28, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: size * 0.32 }}
        className={cn("grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-muted", className)}
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote crests, no optimisation needed
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** True after the first client render. Use it for anything that depends on the viewer's clock or time zone. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  time: { hour: "2-digit", minute: "2-digit" },
  day: { weekday: "short", day: "numeric", month: "short" },
  date: { day: "numeric", month: "short", year: "numeric" },
  datetime: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
};

/** A date or time in the viewer's local time zone. */
export function LocalTime({ iso, format }: { iso: string; format: keyof typeof FORMATS }) {
  const mounted = useMounted();
  return (
    <time dateTime={iso} className="tabular">
      {mounted ? new Intl.DateTimeFormat(undefined, FORMATS[format]).format(new Date(iso)) : " "}
    </time>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * A number that counts up to its value, and animates between values when it changes.
 * The server renders the final value, so it reads correctly without JavaScript.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  signed = false,
  percent = false,
  duration = 900,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Show + / − in front. */
  signed?: boolean;
  /** Value is a fraction (0.12) shown as a percentage (12.0%). */
  percent?: boolean;
  duration?: number;
}) {
  const shown = percent ? value * 100 : value;
  const [display, setDisplay] = useState(shown);
  // The value currently on screen; a new target animates from here (from 0 on first mount).
  const live = useRef<number | null>(null);

  useLayoutEffect(() => {
    const set = (v: number) => {
      live.current = v;
      setDisplay(v);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(shown);
      return;
    }
    const start = live.current ?? 0;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      set(start + (shown - start) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    set(start);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, duration]);

  const rounded = Number(display.toFixed(decimals));
  const sign = signed ? (rounded > 0 ? "+" : rounded < 0 ? "−" : "") : rounded < 0 ? "−" : "";
  return (
    <span className="tabular">
      {sign}
      {prefix}
      {Math.abs(rounded).toFixed(decimals)}
      {suffix}
      {percent && "%"}
    </span>
  );
}
