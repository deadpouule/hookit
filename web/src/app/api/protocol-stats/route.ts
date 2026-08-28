import { NextResponse } from "next/server";

import { loadLiveProtocolStats } from "@/lib/server-protocol-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await loadLiveProtocolStats();
    return NextResponse.json(stats, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load protocol stats";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
