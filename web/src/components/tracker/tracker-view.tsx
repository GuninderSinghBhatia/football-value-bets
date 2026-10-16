"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, Clock, ExternalLink, Trash2 } from "lucide-react";
import { CalibrationChart, HitRateBars, RoiAreaChart } from "@/components/charts/lazy";
import { MARKET_OPTIONS, leagueOptions } from "@/components/ui/filter-options";
import { AnimatedNumber, Crest, LocalTime, useMounted } from "@/components/ui/client";
import { Card, ConfidenceBadge, EmptyState, EvText, Skeleton } from "@/components/ui/primitives";
import { Segmented, Select } from "@/components/ui/select";
import { BOOK_NAMES, marketLabel, odds, pct, selectionLabel, signedPct, units } from "@/lib/format";
import type { League, PicksSummary, TrackedPick } from "@/lib/types";
import { useSetParam } from "@/lib/use-set-param";
import { cn } from "@/lib/utils";
import { usePicks } from "./picks-context";

type Tab = "upcoming" | "live" | "settled";
const TABS: { value: Tab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "settled", label: "Settled" },
];

const tabOf = (p: TrackedPick): Tab => {
  if (p.status !== "pending") return "settled";
  if (p.live?.status === "live") return "live";
  if (p.live?.status === "finished" || p.live?.status === "postponed" || p.live?.status === "cancelled") return "settled";
  return "upcoming";
};

export function TrackerView({ leagues }: { leagues: League[] }) {
  const mounted = useMounted();
  const { picks, loaded, markSeen } = usePicks();
  const params = useSearchParams();
  const setParam = useSetParam();
  const tab: Tab = (["upcoming", "live", "settled"] as const).find((t) => t === params.get("tab")) ?? "upcoming";

  const [range, setRange] = useState("all");
  const [league, setLeague] = useState("all");
  const [market, setMarket] = useState("all");
  const [result, setResult] = useState("all");
  const [conf, setConf] = useState("all");
  const [tag, setTag] = useState("all");
  const [book, setBook] = useState("all");

  // Summary cards and charts come from the API so they match the backend's numbers.
  const [summary, setSummary] = useState<PicksSummary | null>(null);
  const signature = picks.map((p) => `${p.id}:${p.status}`).join(",");
  useEffect(() => {
    fetch("/api/picks/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [signature]);

  useEffect(() => {
    if (tab === "settled") markSeen();
  }, [tab, markSeen]);

  if (!mounted || !loaded) return <Skeleton className="h-96 w-full rounded-card" />;

  const tags = [...new Set(picks.flatMap((p) => p.tags ?? []))].sort();
  const books = [...new Set(picks.map((p) => p.bookmaker))];
  const since = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
  const filtered = picks.filter(
    (p) =>
      tabOf(p) === tab &&
      Date.parse(p.match.kickoff) >= since &&
      (league === "all" || p.match.leagueId === league) &&
      (market === "all" || p.market === market) &&
      (result === "all" || p.status === result) &&
      (conf === "all" || p.confidence === conf) &&
      (tag === "all" || p.tags?.includes(tag)) &&
      (book === "all" || p.bookmaker === book),
  );
  const counts = Object.fromEntries(TABS.map((t) => [t.value, picks.filter((p) => tabOf(p) === t.value).length]));

  if (picks.length === 0)
    return (
      <Card>
        <EmptyState
          title="No saved picks yet"
          hint="Tap the bookmark on any Top pick or on a bet in a match page. BetMind will check the result automatically after full time."
        />
      </Card>
    );

  return (
    <>
      {summary && <SummaryCards s={summary} />}

      <Card title="Profit over time" action={<span className="text-xs text-muted">Settled picks, units</span>}>
        {summary && summary.profitSeries.length > 0 ? (
          <RoiAreaChart data={summary.profitSeries} />
        ) : (
          <EmptyState title="Nothing settled yet" hint="The chart fills in as your saved matches finish." />
        )}
      </Card>

      <Card title="Saved predictions">
        <div className="mb-4 space-y-3">
          <Segmented
            label="Status"
            value={tab}
            onChange={(t) => setParam("tab", t === "upcoming" ? null : t)}
            options={TABS.map((t) => ({ value: t.value, label: `${t.label} (${counts[t.value]})` }))}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select
              label="Kickoff"
              value={range}
              onChange={setRange}
              options={[
                { value: "all", label: "Any date" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
              ]}
            />
            <Select label="League" value={league} onChange={setLeague} options={leagueOptions(leagues)} />
            <Select label="Market" value={market} onChange={(v) => setMarket(v)} options={MARKET_OPTIONS} />
            <Select
              label="Result"
              value={result}
              onChange={setResult}
              options={[
                { value: "all", label: "Any result" },
                { value: "won", label: "✅ Won" },
                { value: "lost", label: "❌ Lost" },
                { value: "void", label: "↩ Void" },
                { value: "pending", label: "⏳ Pending" },
              ]}
            />
            <Select
              label="Confidence"
              value={conf}
              onChange={setConf}
              options={[
                { value: "all", label: "Any level" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <Select
              label="Tag"
              value={tag}
              onChange={setTag}
              options={[{ value: "all", label: "Any tag" }, ...tags.map((t) => ({ value: t, label: `#${t}` }))]}
            />
            <Select
              label="Bookmaker"
              value={book}
              onChange={setBook}
              options={[{ value: "all", label: "Any bookmaker" }, ...books.map((b) => ({ value: b, label: BOOK_NAMES[b] ?? b }))]}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={tab === "live" ? "None of your picks are live right now" : "No picks here"}
            hint="Try another tab or clear the filters."
          />
        ) : (
          <ul key={`${tab}|${filtered.length}`} className="stagger space-y-2">
            {filtered.map((p) => (
              <li key={p.id}>{tab === "settled" ? <SettledRow p={p} /> : <OpenRow p={p} />}</li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function SummaryCards({ s }: { s: PicksSummary }) {
  const cards: [string, React.ReactNode, string?, boolean?][] = [
    ["Saved", <AnimatedNumber key="t" value={s.total} />, `${s.settled} settled · ${s.pending} pending`],
    ["Hit rate", s.hitRate == null ? "–" : <AnimatedNumber key="h" value={s.hitRate} decimals={1} percent />, undefined, true],
    [
      "Profit",
      <AnimatedNumber key="p" value={s.profit} decimals={2} suffix="u" signed />,
      s.roi == null ? "ROI –" : `ROI ${signedPct(s.roi)}`,
    ],
    ["Avg CLV", s.avgClv == null ? "–" : <AnimatedNumber key="c" value={s.avgClv} decimals={1} percent signed />, "vs closing odds"],
    ["Streak", s.streak ? `${s.streak.length}${s.streak.kind}` : "–", s.streak ? (s.streak.kind === "W" ? "wins in a row" : "losses in a row") : "no results yet"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map(([label, value, hint, highlight]) => (
        <div
          key={label}
          className={cn(
            "rounded-card border p-4",
            highlight ? "border-accent/40 bg-surface" : "bg-surface",
          )}
        >
          <div className="text-xs text-muted">{label}</div>
          <div className={cn("tabular mt-1 text-2xl font-bold", highlight && "text-accent-text")}>{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
        </div>
      ))}
    </div>
  );
}

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return <span>Starting</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="tabular">{d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`}</span>;
}

function MatchLine({ p }: { p: TrackedPick }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
      <Crest src={p.match.home.crestUrl} name={p.match.home.name} size={20} />
      <span className="truncate">{p.match.home.name}</span>
      {p.live?.scoreLine ? (
        <span className="tabular max-w-[50%] shrink-0 truncate rounded-md bg-bg px-2 py-0.5 font-bold">{p.live.scoreLine}</span>
      ) : p.live?.score ? (
        <span className="tabular shrink-0 rounded-md bg-bg px-2 py-0.5 font-bold">
          {p.live.score.home} – {p.live.score.away}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted">vs</span>
      )}
      <span className="truncate">{p.match.away.name}</span>
      <Crest src={p.match.away.crestUrl} name={p.match.away.name} size={20} />
    </div>
  );
}

function OpenRow({ p }: { p: TrackedPick }) {
  const { remove } = usePicks();
  const current = p.live?.currentOdds;
  const moved = current ? current - p.oddsAtSave : 0;
  const isLive = p.live?.status === "live";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
      <div className="min-w-0">
        <MatchLine p={p} />
        <div className="mt-1 text-xs text-muted">
          {p.match.league} · <LocalTime iso={p.match.kickoff} format="datetime" />
        </div>
        <div className="mt-1 text-sm">
          <span className="font-medium">{selectionLabel(p.market, p.selection, p.match.home.name, p.match.away.name)}</span>
          <span className="text-muted"> · {p.stake}u</span>
        </div>
      </div>

      <div className="hidden text-sm sm:block">
        <div className="text-xs text-muted">Saved → now</div>
        <div className="tabular flex items-center gap-1.5">
          {odds(p.oddsAtSave)}
          {current ? (
            <>
              <span className="text-muted">→</span>
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", moved > 0 ? "text-positive" : moved < 0 ? "text-negative-text" : "")}>
                {odds(current)}
                {moved > 0 ? <ArrowUp className="size-3.5" aria-label="drifted" /> : moved < 0 ? <ArrowDown className="size-3.5" aria-label="shortened" /> : null}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted">· no live price</span>
          )}
        </div>
      </div>

      <div className="hidden text-sm sm:block">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-negative-bg px-1.5 py-0.5 text-xs font-bold text-negative-text">
              <span className="size-1.5 animate-pulse rounded-full bg-negative" aria-hidden /> LIVE {p.live?.statusDetail}
          </span>
        ) : (
          <>
            <div className="text-xs text-muted">Kickoff in</div>
            <div className="inline-flex items-center gap-1 font-semibold">
              <Clock className="size-3.5 text-muted" aria-hidden /> <Countdown iso={p.match.kickoff} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/match/${p.matchId}`}
          aria-label="Open match"
          className="grid size-9 place-items-center rounded-[10px] bg-surface-2 text-muted transition-all duration-200 hover:text-text active:scale-90"
        >
          <ExternalLink className="size-4" />
        </Link>
        {!isLive && (
          <button
            type="button"
            onClick={() => remove(p.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface-2 px-3 text-sm text-muted transition-all duration-200 hover:text-negative-text active:scale-95"
          >
            <Trash2 className="size-4" /> <span className="hidden sm:inline">Remove</span>
          </button>
        )}
      </div>
    </div>
  );
}

const RESULT_PILL: Record<string, [string, string]> = {
  won: ["✅ Won", "bg-positive-bg text-positive"],
  lost: ["❌ Lost", "bg-negative-bg text-negative-text"],
  void: ["↩ Void", "bg-surface-2 text-muted"],
  pending: ["⏳ Pending", "bg-warning-bg text-warning"],
};

function SettledRow({ p }: { p: TrackedPick }) {
  const [open, setOpen] = useState(false);
  const [label, style] = RESULT_PILL[p.status];
  return (
    <div className="rounded-xl bg-surface-2/60">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full px-3 py-3 text-left">
        <div className="flex items-center justify-between gap-3">
          <MatchLine p={{ ...p, live: p.finalScore ? { status: "finished", ...toScore(p.finalScore) } : p.live }} />
          <span className="flex shrink-0 items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", style)}>{label}</span>
            <ChevronDown className={cn("size-4 text-muted transition-transform duration-300", open && "rotate-180")} />
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <LocalTime iso={p.match.kickoff} format="day" />
          <span className="font-medium text-text">{selectionLabel(p.market, p.selection, p.match.home.name, p.match.away.name)}</span>
          <span className="tabular">@ {odds(p.oddsAtSave)}</span>
          <span className="tabular">model {pct(p.modelProb)}</span>
          <span
            className={cn(
              "tabular font-semibold",
              (p.profit ?? 0) > 0 ? "text-positive" : (p.profit ?? 0) < 0 ? "text-negative-text" : "",
            )}
          >
            {p.profit != null ? units(p.profit) : "P/L –"}
          </span>
          <span className="tabular">{p.clv != null ? `CLV ${signedPct(p.clv)}` : "CLV –"}</span>
        </div>
      </button>

      {open && (
        <div className="animate-fade-in border-t px-3 py-3 text-sm">
          {p.pendingReason && <p className="mb-2 text-warning">{p.pendingReason}</p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {[
              ["Saved", <LocalTime key="s" iso={p.savedAt} format="datetime" />],
              ["Bookmaker", BOOK_NAMES[p.bookmaker] ?? p.bookmaker],
              ["Odds at save", odds(p.oddsAtSave)],
              [
                "Closing odds",
                p.closingOdds ? (
                  <span key="co">
                    {odds(p.closingOdds)}
                    {p.closingBook && p.closingBook !== p.bookmaker && (
                      <span
                        className="ml-1 text-xs font-normal text-warning"
                        title={`${BOOK_NAMES[p.bookmaker] ?? p.bookmaker} had no closing price, so CLV uses ${BOOK_NAMES[p.closingBook] ?? p.closingBook}'s`}
                      >
                        ({BOOK_NAMES[p.closingBook] ?? p.closingBook})
                      </span>
                    )}
                  </span>
                ) : (
                  "–"
                ),
              ],
              ["Model %", pct(p.modelProb)],
              ["Implied %", pct(p.impliedProb)],
              ["EV at save", <EvText key="e" ev={p.ev} />],
              ["Confidence", <ConfidenceBadge key="c" level={p.confidence} />],
              ["Stake", `${p.stake}u`],
              ["P/L", p.profit != null ? units(p.profit) : "–"],
              ["CLV", p.clv != null ? signedPct(p.clv) : "–"],
              ["Model version", p.modelVersion],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {p.note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-muted">“{p.note}”</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {p.tags?.map((t) => (
              <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                #{t}
              </span>
            ))}
            <Link href={`/match/${p.matchId}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">
              Match detail <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** "2-1" → score; anything else (tennis sets, UFC round, cricket) is shown as text. */
const toScore = (s: string): { score?: { home: number; away: number }; scoreLine?: string } => {
  const m = /^(d+)-(d+)$/.exec(s);
  return m ? { score: { home: Number(m[1]), away: Number(m[2]) } } : { scoreLine: s };
};

/** Right-column charts for the tracker page. */
export function TrackerCharts() {
  const { picks } = usePicks();
  const [summary, setSummary] = useState<PicksSummary | null>(null);
  const signature = picks.map((p) => `${p.id}:${p.status}`).join(",");
  useEffect(() => {
    fetch("/api/picks/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [signature]);
  const decided = summary?.hitRateByMarket.reduce((s, m) => s + m.count, 0) ?? 0;

  return (
    <>
      <Card title="Hit rate by market">
        {summary && summary.hitRateByMarket.length ? (
          <HitRateBars data={summary.hitRateByMarket.map((m) => ({ ...m, label: marketLabel(m.market) }))} />
        ) : (
          <p className="text-sm text-muted">Appears once saved picks settle.</p>
        )}
      </Card>
      <Card title="Calibration (saved picks)">
        {decided >= 10 && summary ? (
          <CalibrationChart data={summary.calibration} />
        ) : (
          <p className="text-sm text-muted">
            Needs at least 10 settled picks ({decided} so far). Then it shows whether the model&apos;s % matches how often picks win.
          </p>
        )}
      </Card>
      <Card>
        <div className="flex items-start gap-3 text-sm text-muted">
          <Bookmark className="mt-0.5 size-4 shrink-0 text-accent-text" />
          Results are checked against the real full-time score every 15 minutes. Postponed or abandoned matches are voided.
        </div>
      </Card>
    </>
  );
}
