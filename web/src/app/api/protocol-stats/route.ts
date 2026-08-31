import { NextResponse } from "next/server";

import { PROTOCOL_STATS_STALE_MS } from "@/lib/query-cache";
import { loadLiveProtocolStats } from "@/lib/server-protocol-stats";

export const revalidate = 12;

const CACHE_SEC = Math.round(PROTOCOL_STATS_STALE_MS / 1000);

export async function GET() {
  try {
    const stats = await loadLiveProtocolStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=30`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load protocol stats";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
