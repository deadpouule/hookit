import { getAddress, isAddress, type Address } from "viem";

import { resolveHookitChainKey } from "@/lib/chains";

/** DexScreener chain slug — not the same as EIP-155 chain id. */
export type DexScreenerChainSlug = "ink" | "base-sepolia";

export type DexScreenerPair = {
  chainId: string;
  pairAddress: string;
  url: string;
  dexId?: string;
  liquidityUsd?: number;
  priceUsd?: string;
  volumeH24?: number;
};

export type DexScreenerChartTarget = {
  chainSlug: DexScreenerChainSlug;
  tokenAddress: Address;
  chartAddress: Address;
  pair: DexScreenerPair | null;
  pageUrl: string;
  embedUrl: string;
};

const DEXSCREENER_ORIGIN = "https://dexscreener.com";
const DEXSCREENER_API = "https://api.dexscreener.com";

export function getDexScreenerChainSlug(): DexScreenerChainSlug {
  return resolveHookitChainKey() === "ink" ? "ink" : "base-sepolia";
}

export function normalizeTokenAddress(value: string | undefined): Address | null {
  if (!value || !isAddress(value)) return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeDexScreenerPair(raw: unknown, chainSlug: DexScreenerChainSlug): DexScreenerPair | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const pairAddress = readString(record.pairAddress);
  if (!pairAddress || !isAddress(pairAddress)) return null;

  const liquidity = record.liquidity;
  const liquidityUsd =
    liquidity && typeof liquidity === "object"
      ? readNumber((liquidity as Record<string, unknown>).usd)
      : undefined;

  const volume = record.volume;
  const volumeH24 =
    volume && typeof volume === "object"
      ? readNumber((volume as Record<string, unknown>).h24)
      : undefined;

  const chainId = readString(record.chainId) ?? chainSlug;
  const url = readString(record.url) ?? `${DEXSCREENER_ORIGIN}/${chainSlug}/${pairAddress}`;

  return {
    chainId,
    pairAddress: getAddress(pairAddress),
    url,
    dexId: readString(record.dexId),
    liquidityUsd,
    priceUsd: readString(record.priceUsd),
    volumeH24,
  };
}

export function pickBestDexScreenerPair(pairs: DexScreenerPair[]): DexScreenerPair | null {
  if (pairs.length === 0) return null;
  return [...pairs].sort((a, b) => {
    const liquidityDelta = (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
    if (liquidityDelta !== 0) return liquidityDelta;
    return (b.volumeH24 ?? 0) - (a.volumeH24 ?? 0);
  })[0];
}

export function dexScreenerPageUrl(chainSlug: DexScreenerChainSlug, address: string): string {
  return `${DEXSCREENER_ORIGIN}/${chainSlug}/${address}`;
}

export function dexScreenerEmbedUrl(chainSlug: DexScreenerChainSlug, address: string): string {
  const params = new URLSearchParams({
    embed: "1",
    theme: "dark",
    trades: "0",
    info: "0",
  });
  return `${dexScreenerPageUrl(chainSlug, address)}?${params.toString()}`;
}

export function buildDexScreenerChartTarget(
  tokenAddress: Address,
  pair: DexScreenerPair | null,
  chainSlug: DexScreenerChainSlug = getDexScreenerChainSlug(),
): DexScreenerChartTarget {
  const chartAddress = pair ? getAddress(pair.pairAddress) : tokenAddress;
  return {
    chainSlug,
    tokenAddress,
    chartAddress,
    pair,
    pageUrl: pair?.url ?? dexScreenerPageUrl(chainSlug, chartAddress),
    embedUrl: dexScreenerEmbedUrl(chainSlug, chartAddress),
  };
}

export async function fetchDexScreenerPairsForToken(
  tokenAddress: Address,
  chainSlug: DexScreenerChainSlug = getDexScreenerChainSlug(),
): Promise<DexScreenerPair[]> {
  const res = await fetch(`${DEXSCREENER_API}/token-pairs/v1/${chainSlug}/${tokenAddress}`, {
    next: { revalidate: 30 },
    headers: { accept: "application/json" },
  });

  if (!res.ok) return [];

  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) return [];

  return body
    .map((item) => normalizeDexScreenerPair(item, chainSlug))
    .filter((item): item is DexScreenerPair => item != null);
}

export async function resolveDexScreenerChartTarget(
  tokenAddress: Address,
  chainSlug: DexScreenerChainSlug = getDexScreenerChainSlug(),
): Promise<DexScreenerChartTarget> {
  const pairs = await fetchDexScreenerPairsForToken(tokenAddress, chainSlug);
  const bestPair = pickBestDexScreenerPair(pairs);
  return buildDexScreenerChartTarget(tokenAddress, bestPair, chainSlug);
}
