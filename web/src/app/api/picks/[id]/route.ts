// DELETE /api/picks/:id   remove a pick (only while its match hasn't started)
import { NextResponse } from "next/server";
import { PickError, removePick } from "@/lib/server/picks-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await removePick((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof PickError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
