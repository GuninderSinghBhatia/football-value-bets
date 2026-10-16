"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  LabelList,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefersReducedMotion } from "@/components/ui/client";
import type { CalibrationBin, RadarRatings, StatsRadar } from "@/lib/types";

const motion = (animate: boolean) => ({ isAnimationActive: animate, animationDuration: 900, animationEasing: "ease-out" as const });

const axis = { stroke: "var(--text-muted)", fontSize: 11, tickLine: false, axisLine: false };
const grid = { stroke: "var(--border)", strokeDasharray: "3 4" };
const tooltipStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};
const tooltipText = { color: "var(--text-primary)" };

const RADAR_AXES: [keyof RadarRatings, string][] = [
  ["attack", "Attack"],
  ["defence", "Defence"],
  ["form", "Form"],
  ["ppg", "Pts/game"],
  ["h2h", "H2H"],
];

export function RadarCompare({
  home,
  away,
  homeName,
  awayName,
  height = 240,
}: {
  home: RadarRatings;
  away: RadarRatings;
  homeName: string;
  awayName: string;
  height?: number;
}) {
  const animate = !usePrefersReducedMotion();
  const data = RADAR_AXES.map(([key, label]) => ({ label, home: home[key], away: away[key] }));
  const homeColor = "var(--accent-yellow)";
  const awayColor = "var(--accent-blue)";
  const label = "var(--text-secondary)";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border-strong)" />
        <PolarAngleAxis dataKey="label" tick={{ fill: label, fontSize: 11 }} />
        <Radar name={homeName} dataKey="home" stroke={homeColor} fill={homeColor} fillOpacity={0.15} {...motion(animate)} />
        <Radar name={awayName} dataKey="away" stroke={awayColor} fill={awayColor} fillOpacity={0.3} {...motion(animate)} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => <span style={{ color: label }}>{value}</span>}
        />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function RoiAreaChart({ data }: { data: { date: string; profit: number }[] }) {
  const animate = !usePrefersReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...grid} vertical={false} />
        <XAxis dataKey="date" {...axis} minTickGap={32} />
        <YAxis {...axis} width={48} tickFormatter={(v: number) => `${v}u`} />
        <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}u`, "Cumulative profit"]}
        />
        <Area type="monotone" dataKey="profit" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#roiFill)" {...motion(animate)} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const animate = !usePrefersReducedMotion();
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke="var(--accent-blue)" strokeWidth={1.5} dot={false} {...motion(animate)} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CalibrationChart({ data }: { data: CalibrationBin[] }) {
  const animate = !usePrefersReducedMotion();
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid {...grid} />
        <XAxis dataKey="predicted" type="number" domain={[0, 1]} ticks={ticks} {...axis} tickFormatter={(v: number) => `${v * 100}%`} />
        <YAxis type="number" domain={[0, 1]} ticks={ticks} {...axis} width={52} tickFormatter={(v: number) => `${v * 100}%`} />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke="var(--text-muted)"
          strokeDasharray="4 4"
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l: number) => `Predicted ${(l * 100).toFixed(1)}%`}
          formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Actual hit rate"]}
        />
        <Line dataKey="actual" stroke="var(--accent-blue)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent-blue)", strokeWidth: 0 }} {...motion(animate)} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HitRateBars({ data }: { data: { label: string; hitRate: number; count: number }[] }) {
  const animate = !usePrefersReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <XAxis type="number" domain={[0, 1]} hide />
        <YAxis type="category" dataKey="label" width={110} {...axis} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--bg-card-hover)" }}
          formatter={(v: number, _n, item) => [`${(v * 100).toFixed(1)}% of ${(item.payload as { count: number }).count}`, "Hit rate"]}
        />
        <Bar dataKey="hitRate" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} barSize={10} {...motion(animate)}>
          <LabelList dataKey="hitRate" position="right" formatter={(v: number) => `${Math.round(v * 100)}%`} fill="var(--text-secondary)" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A radar with any axes (other sports' stats). Same look as RadarCompare. */
export function StatsRadarChart({
  radar,
  homeName,
  awayName,
  height = 260,
}: {
  radar: StatsRadar;
  homeName: string;
  awayName: string;
  height?: number;
}) {
  const animate = !usePrefersReducedMotion();
  const data = radar.axes.map(({ key, label }) => ({ label, home: radar.home[key], away: radar.away[key] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border-strong)" />
        <PolarAngleAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
        <Radar name={homeName} dataKey="home" stroke="var(--accent-yellow)" fill="var(--accent-yellow)" fillOpacity={0.15} {...motion(animate)} />
        <Radar name={awayName} dataKey="away" stroke="var(--accent-blue)" fill="var(--accent-blue)" fillOpacity={0.3} {...motion(animate)} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipText} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/**
 * Each bookmaker's implied probability for both sides (bars), with the no-vig consensus as a dashed line per side.
 * A bar below its line is a price longer than fair: that's where the value is.
 */
export function OddsCompareChart({
  rows,
  names,
  bookNames,
  height = 240,
}: {
  rows: { selection: string; modelProb: number; prices?: { bookmaker: string; odds: number }[] }[];
  /** Display name per selection ("Home" → "Sinner"). */
  names: Record<string, string>;
  bookNames: Record<string, string>;
  height?: number;
}) {
  const animate = !usePrefersReducedMotion();
  const sides = rows.filter((r) => r.prices?.length);
  const books = [...new Set(sides.flatMap((r) => r.prices!.map((p) => p.bookmaker)))];
  const data = books.map((b) => {
    const point: Record<string, string | number | null> = { book: bookNames[b] ?? b };
    for (const r of sides) {
      const price = r.prices!.find((p) => p.bookmaker === b)?.odds;
      point[r.selection] = price ? Math.round(1000 / price) / 10 : null;
      point[`${r.selection}_odds`] = price ?? null;
    }
    return point;
  });
  const colors = ["var(--accent-yellow)", "var(--accent-blue)", "var(--text-secondary)"];
  const label = "var(--text-secondary)";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} {...grid} />
        <XAxis dataKey="book" {...axis} stroke={label} interval={0} tick={{ fontSize: 10, fill: label }} />
        <YAxis
          {...axis}
          stroke={label}
          unit="%"
          domain={[(min: number) => Math.max(0, Math.floor(min - 4)), (max: number) => Math.min(100, Math.ceil(max + 4))]}
          allowDataOverflow
          tick={{ fontSize: 10, fill: label }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipText}
          cursor={{ fill: "var(--bg-card-hover)" }}
          formatter={(value, name, item) => {
            const odds = (item.payload as Record<string, number | null>)[`${String(item.dataKey)}_odds`];
            return [`${value}%${odds ? ` (odds ${odds.toFixed(2)})` : ""}`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => <span style={{ color: label }}>{value}</span>} />
        {sides.map((r, i) => (
          <Bar key={r.selection} dataKey={r.selection} name={names[r.selection] ?? r.selection} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} {...motion(animate)} />
        ))}
        {sides.map((r, i) => (
          <ReferenceLine
            key={`fair-${r.selection}`}
            y={Math.round(r.modelProb * 1000) / 10}
            stroke={colors[i % colors.length]}
            strokeDasharray="5 4"
            ifOverflow="extendDomain"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
