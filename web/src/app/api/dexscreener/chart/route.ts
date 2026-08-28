import { NextResponse } from "next/server";

import {
  getDexScreenerChainSlug,
  normalizeTokenAddress,
  resolveDexScreenerChartTarget,
} from "@/lib/dexscreener";

export const revalidate = 30;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const tokenAddress = normalizeTokenAddress(token ?? undefined);

  if (!tokenAddress) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const chainSlug = getDexScreenerChainSlug();
    const chart = await resolveDexScreenerChartTarget(tokenAddress, chainSlug);
    return NextResponse.json(chart);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DexScreener lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
