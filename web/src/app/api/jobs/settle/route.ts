// POST /api/jobs/settle   settle finished matches (also runs every 15 minutes from instrumentation.ts).
// If CRON_SECRET is set, callers must send it as a Bearer token.
import { NextResponse } from "next/server";
import { settlePending } from "@/lib/server/picks-service";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await settlePending());
}
