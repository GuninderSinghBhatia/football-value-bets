// GET /api/leagues?sport=tennis   leagues for the sidebar of the selected sport (default football).
import { NextResponse } from "next/server";
import { parseSport } from "@/config/sports";
import { getSportLeagues } from "@/lib/api";

export async function GET(req: Request) {
  const sport = parseSport(new URL(req.url).searchParams.get("sport"));
  return NextResponse.json(await getSportLeagues(sport));
}
