import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Sparkline } from "@/components/charts/lazy";
import { AnimatedNumber } from "@/components/ui/client";
import { Card } from "@/components/ui/primitives";
import type { ModelGlance as Glance } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ModelGlance({ glance }: { glance: Glance }) {
  return (
    <Card title="Model at a glance">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-muted">Picks today</dt>
          <dd className="mt-1 text-3xl font-bold">
            <AnimatedNumber value={glance.picksToday} />
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <dt className="text-xs text-muted">Avg EV</dt>
          <dd className="mt-1 text-3xl font-bold">
            <AnimatedNumber value={glance.avgEv} decimals={1} percent signed />
          </dd>
        </div>
      </dl>
      <div className="mt-3 rounded-xl bg-surface-2 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted">
            ROI, last 30 days <span className="rounded bg-warning/15 px-1 text-[10px] font-semibold text-warning">SAMPLE</span>
            <span className="block">{glance.roi30dPicks} settled picks</span>
          </span>
          <span className={cn("tabular text-xl font-bold", glance.roi30d >= 0 ? "text-positive" : "text-negative-text")}>
            <AnimatedNumber value={glance.roi30d} decimals={1} percent signed />
          </span>
        </div>
        <Sparkline values={glance.roi30dSeries} />
      </div>
      <Link href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">
        View performance <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
