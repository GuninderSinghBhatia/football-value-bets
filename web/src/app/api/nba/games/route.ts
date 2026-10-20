import { NextResponse } from "next/server";
import { readTonight } from "@/lib/server/nba-store";

export const dynamic = "force-dynamic";

/** GET /api/nba/games?date=YYYY-MM-DD lists the slate's games (without props). */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  const tonight = await readTonight();
  const games = (tonight?.games ?? [])
    .filter((g) => !date || g.start_time.startsWith(date))
    .map(({ props, ...g }) => ({ ...g, props: props.length, picks: props.filter((p) => p.pick).length }));
  return NextResponse.json({ generated_at: tonight?.generated_at ?? null, games });
}
