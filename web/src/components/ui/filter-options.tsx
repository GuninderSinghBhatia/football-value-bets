"use client";

import { Globe2, Layers } from "lucide-react";
import { Crest } from "./client";
import type { Option } from "./select";
import type { League } from "@/lib/types";

const Logo = ({ src, name }: { src: string; name: string }) => (
  <span className="grid size-5 place-items-center rounded-full bg-text p-0.5">
    <Crest src={src} name={name} size={14} />
  </span>
);

export const leagueOptions = (leagues: League[]): Option<string>[] => [
  { value: "all", label: "All leagues", icon: <Globe2 className="size-4 text-muted" /> },
  ...leagues.map((l) => ({ value: l.id, label: l.name, icon: <Logo src={l.logoUrl} name={l.name} /> })),
];

export type MarketFilter = "all" | "1X2" | "OU_2.5" | "BTTS" | "DC" | "CARDS_4.5" | "CORNERS_9.5";

export const MARKET_OPTIONS: Option<MarketFilter>[] = [
  { value: "all", label: "All markets", icon: <Layers className="size-4 text-muted" /> },
  { value: "1X2", label: "Match result", hint: "1X2" },
  { value: "DC", label: "Double chance", hint: "DC" },
  { value: "OU_2.5", label: "Goals 2.5", hint: "O/U" },
  { value: "BTTS", label: "Both teams score", hint: "BTTS" },
  { value: "CARDS_4.5", label: "Cards 4.5", hint: "O/U" },
  { value: "CORNERS_9.5", label: "Corners 9.5", hint: "O/U" },
];

const Dot = ({ className }: { className: string }) => <span className={`block size-2 rounded-full ${className}`} />;

export const CONFIDENCE_OPTIONS: Option<"low" | "medium" | "high">[] = [
  { value: "low", label: "Any level", icon: <Dot className="bg-negative" /> },
  { value: "medium", label: "Medium+", icon: <Dot className="bg-caution" /> },
  { value: "high", label: "High only", icon: <Dot className="bg-positive" /> },
];

export const MIN_EV_OPTIONS: Option<string>[] = [
  { value: "0", label: "Any value" },
  { value: "0.03", label: "3% or more" },
  { value: "0.05", label: "5% or more" },
  { value: "0.07", label: "7% or more" },
];

export const DATE_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "tomorrow" as const, label: "Tomorrow" },
  { value: "week" as const, label: "This week" },
];
