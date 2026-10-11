// GET /api/picks?status=&league=&from=&to=   list saved picks with live state
// POST /api/picks                            save a pick (snapshot)
import { NextResponse } from "next/server";
import { listPicks, PickError, savePick } from "@/lib/server/picks-service";
import type { SavePickInput } from "@/lib/types";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const picks = await listPicks({
    status: q.get("status") ?? undefined,
    league: q.get("league") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
  });
  return NextResponse.json(picks);
}

export async function POST(req: Request) {
  let body: SavePickInput;
  try {
    body = (await req.json()) as SavePickInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const required = ["matchId", "market", "selection", "bookmaker", "oddsAtSave", "modelProb", "impliedProb", "ev", "confidence"] as const;
  const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
  if (missing.length) return NextResponse.json({ error: `Missing: ${missing.join(", ")}` }, { status: 400 });
  try {
    const pick = await savePick({ ...body, stake: Number(body.stake ?? 1) });
    return NextResponse.json(pick, { status: 201 });
  } catch (e) {
    if (e instanceof PickError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
