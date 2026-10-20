import { NextResponse } from "next/server";
import { readTonight } from "@/lib/server/nba-store";

export const dynamic = "force-dynamic";

/** GET /api/nba/props?game_id= lists one game's props with line, odds, prediction, P(over), EV and pick. */
export async function GET(req: Request) {
  const gameId = new URL(req.url).searchParams.get("game_id");
  const tonight = await readTonight();
  const games = tonight?.games ?? [];
  const props = games.filter((g) => !gameId || g.event_id === gameId).flatMap((g) => g.props);
  if (gameId && props.length === 0 && !games.some((g) => g.event_id === gameId))
    return NextResponse.json({ error: "unknown game_id" }, { status: 404 });
  return NextResponse.json({ generated_at: tonight?.generated_at ?? null, props });
}
