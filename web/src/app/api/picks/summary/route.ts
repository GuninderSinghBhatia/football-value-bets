// GET /api/picks/summary   summary cards and chart data for the tracker
import { NextResponse } from "next/server";
import { getSummary } from "@/lib/server/picks-service";

export async function GET() {
  return NextResponse.json(await getSummary());
}
