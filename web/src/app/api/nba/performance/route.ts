import { NextResponse } from "next/server";
import { readPerformance } from "@/lib/server/nba-store";

export const dynamic = "force-dynamic";

/** GET /api/nba/performance returns ROI, profit curve, win rate, CLV, drawdown and the Gate 2 check. */
export async function GET() {
  const perf = await readPerformance();
  if (!perf) return NextResponse.json({ error: "pipeline has not run yet" }, { status: 404 });
  return NextResponse.json(perf);
}
