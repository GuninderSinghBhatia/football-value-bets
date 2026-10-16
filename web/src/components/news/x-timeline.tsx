"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";

// X's free embed widget (platform.twitter.com/widgets.js). No API key, but X decides what it shows: logged-out
// viewers, tracking protection or ad blockers can leave it blank, so every timeline has a fallback link.

type Twttr = {
  ready: (cb: (t: Twttr) => void) => void;
  widgets: {
    createTimeline: (
      source: { sourceType: "profile"; screenName: string },
      target: HTMLElement,
      options: Record<string, unknown>,
    ) => Promise<HTMLElement | undefined>;
  };
};

declare global {
  interface Window {
    twttr?: Twttr;
  }
}

let loader: Promise<Twttr> | null = null;

function loadWidgets(): Promise<Twttr> {
  if (loader) return loader;
  loader = new Promise<Twttr>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => (window.twttr ? window.twttr.ready(resolve) : reject(new Error("widgets.js loaded without twttr")));
    script.onerror = () => reject(new Error("widgets.js blocked"));
    document.body.appendChild(script);
  });
  loader.catch(() => (loader = null)); // allow a retry after a blocker is switched off
  return loader;
}

const TIMEOUT_MS = 12_000;

export function XTimeline({ handle, height = 640 }: { handle: string; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "failed">("waiting");
  const [attempt, setAttempt] = useState(0);

  // Only build the embed once the column scrolls into view; each one is a heavy iframe.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState((s) => (s === "waiting" ? "loading" : s));
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (state !== "loading" || !host.current) return;
    const el = host.current;
    let cancelled = false;
    el.replaceChildren();
    const timer = setTimeout(() => !cancelled && setState("failed"), TIMEOUT_MS);
    loadWidgets()
      .then((twttr) =>
        twttr.widgets.createTimeline({ sourceType: "profile", screenName: handle }, el, {
          theme: "dark",
          chrome: "noheader nofooter noborders transparent",
          height,
          dnt: true,
        }),
      )
      .then((frame) => !cancelled && setState(frame ? "ready" : "failed"))
      .catch(() => !cancelled && setState("failed"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, handle, height, attempt]);

  return (
    <div className="relative" style={{ minHeight: state === "ready" ? undefined : 240 }}>
      <div ref={host} className={state === "failed" ? "hidden" : undefined} />
      {(state === "waiting" || state === "loading") && (
        <div className="absolute inset-0 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {state === "failed" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
          <p className="text-sm text-muted">
            X didn&apos;t load this timeline. That usually means you&apos;re logged out of X in this browser, or a tracker
            blocker stopped it.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAttempt((n) => n + 1);
                setState("loading");
              }}
              className="rounded-[10px] bg-surface-2 px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
            >
              Try again
            </button>
            <a
              href={`https://x.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent-fill px-3 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-dim"
            >
              Open @{handle} on X <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
