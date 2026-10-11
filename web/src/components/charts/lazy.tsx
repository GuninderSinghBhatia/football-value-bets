"use client";

// Charts are loaded on demand so Recharts isn't in the initial bundle.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";

export const RadarCompare = dynamic(() => import("./charts").then((m) => m.RadarCompare), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full" />,
});
export const RoiAreaChart = dynamic(() => import("./charts").then((m) => m.RoiAreaChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});
export const Sparkline = dynamic(() => import("./charts").then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-12 w-full" />,
});
export const CalibrationChart = dynamic(() => import("./charts").then((m) => m.CalibrationChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});
export const HitRateBars = dynamic(() => import("./charts").then((m) => m.HitRateBars), {
  ssr: false,
  loading: () => <Skeleton className="h-32 w-full" />,
});
