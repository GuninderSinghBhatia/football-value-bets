import { NextResponse } from "next/server";
import { readBets } from "@/lib/server/nba-store";

export const dynamic = "force-dynamic";

/** GET /api/nba/bets?date=YYYY-MM-DD&player=&status=open|won|lost|void lists paper bets. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date");
  const player = q.get("player")?.toLowerCase();
  const status = q.get("status");
  const bets = (await readBets()).filter(
    (b) =>
      (!date || b.start_time.startsWith(date)) &&
      (!player || b.player.toLowerCase().includes(player) || String(b.player_id) === player) &&
      (!status || b.status === status),
  );
  return NextResponse.json(bets);
}
