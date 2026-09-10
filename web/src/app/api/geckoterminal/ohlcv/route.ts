import { NextResponse } from "next/server";

import { normalizeTokenAddress } from "@/lib/dexscreener";
import { fetchGeckoTerminalBars } from "@/lib/geckoterminal";
import { CHART_TIMEFRAMES, type ChartInterval } from "@/lib/token-chart";

export const revalidate = 30;

function isChartInterval(value: string | null): value is ChartInterval {
  return !!value && (CHART_TIMEFRAMES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenAddress = normalizeTokenAddress(url.searchParams.get("token") ?? undefined);
  const interval = url.searchParams.get("interval");

  if (!tokenAddress) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }
  if (!isChartInterval(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  try {
    const result = await fetchGeckoTerminalBars(tokenAddress, interval);
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json({ error: "Rate limited", bars: [], pool: null }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "GeckoTerminal lookup failed";
    return NextResponse.json({ error: message, bars: [], pool: null }, { status: 502 });
  }
}
