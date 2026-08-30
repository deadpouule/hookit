import { type Address, zeroAddress } from "viem";
import type { PublicClient } from "viem";

import { STABLE_QUOTE_ADDRESS, getChainDeployment } from "@/lib/contracts/config";
import { marketCapUsd, stateViewAbi } from "@/lib/pool-price";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import { isRwaQuote } from "@/lib/token-identity";
import type { TokenPool } from "@/lib/types";
import {
  INK_QUOTRON_STOCKS,
  fetchQuotronStockUsdPrice,
  type QuotronStockListing,
} from "@/lib/xstocks";

export type QuoteKind = "eth" | "stable" | "rwa";

const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;

/** Quote per 1 whole token (raw ratio from sqrtPriceX96) → quote wei for `tokenAmount` wei. */
export function quoteFromTokenWei(
  tokenAmount: bigint,
  sqrtPriceX96: bigint,
  tokenIsCurrency0: boolean,
): bigint {
  if (tokenAmount === 0n || sqrtPriceX96 === 0n) return 0n;
  if (tokenIsCurrency0) {
    const step = (tokenAmount * sqrtPriceX96) / Q96;
    return (step * sqrtPriceX96) / Q96;
  }
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  return (tokenAmount * Q192) / priceX192;
}

export function resolveQuoteKind(
  quoteAddress?: Address | string,
  quoteAsset?: string,
): QuoteKind {
  if (!quoteAddress || quoteAddress === zeroAddress) return "eth";
  const addr = quoteAddress.toLowerCase();
  if (addr === STABLE_QUOTE_ADDRESS.toLowerCase()) return "stable";
  if (isRwaQuote(quoteAsset, quoteAddress as Address)) return "rwa";
  return "stable";
}

export function quoteDecimalsForKind(kind: QuoteKind): number {
  if (kind === "eth" || kind === "rwa") return 18;
  return 6;
}

export function quotronStockByAddress(address?: string): QuotronStockListing | undefined {
  if (!address) return undefined;
  const key = address.toLowerCase();
  return INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === key);
}

export function fallbackStockUsd(address?: string): number {
  const listing = quotronStockByAddress(address);
  return listing?.fallbackUsd ?? 0;
}

/** Spot USD for 1 whole wStock from a live Quotrons wStock/USDG pool. */
export async function stockUsdFromQuotronPool(
  client: PublicClient,
  listing: QuotronStockListing,
): Promise<number | null> {
  const stateView = getChainDeployment().stateView;
  const slot = await client
    .readContract({
      address: stateView,
      abi: stateViewAbi,
      functionName: "getSlot0",
      args: [listing.quotronPoolId],
    })
    .catch(() => null);
  if (!slot) return null;
  const [sqrtPriceX96] = slot as readonly [bigint, number, number, number];
  if (sqrtPriceX96 === 0n) return null;

  const stockIsCurrency0 = BigInt(listing.address) < BigInt(STABLE_QUOTE_ADDRESS);
  const usdgWei = quoteFromTokenWei(BigInt(10) ** BigInt(18), sqrtPriceX96, stockIsCurrency0);
  if (usdgWei === 0n) return null;
  return Number(usdgWei) / 1e6;
}

/** Resolve USD price of one unit of the pool quote (1 ETH, 1 USDG, or 1 wStock). */
export async function resolveQuoteUsdPrice(
  quoteAddress: Address | undefined,
  quoteAsset: string | undefined,
  ethUsd: number,
  client?: PublicClient,
): Promise<number> {
  const kind = resolveQuoteKind(quoteAddress, quoteAsset);
  if (kind === "eth") return ethUsd;
  if (kind === "stable") return 1;

  const listing = quotronStockByAddress(quoteAddress);
  if (!listing) return fallbackStockUsd(quoteAddress) || 1;

  const api = await fetchQuotronStockUsdPrice(listing);
  if (api && api > 0) return api;

  if (client) {
    const live = await stockUsdFromQuotronPool(client, listing);
    if (live && live > 0) return live;
  }

  return listing.fallbackUsd ?? 1;
}

/** Build quote-address → USD map for a batch of pools (server-side enrichment). */
export async function buildQuoteUsdMap(
  client: PublicClient,
  pools: TokenPool[],
  ethUsd: number,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  map.set(zeroAddress.toLowerCase(), ethUsd);
  map.set(STABLE_QUOTE_ADDRESS.toLowerCase(), 1);

  const rwaListings = new Map<string, QuotronStockListing>();
  for (const pool of pools) {
    if (resolveQuoteKind(pool.quoteAddress, pool.quoteAsset) !== "rwa" || !pool.quoteAddress) continue;
    const listing = quotronStockByAddress(pool.quoteAddress);
    if (listing) rwaListings.set(listing.address.toLowerCase(), listing);
  }

  await Promise.all(
    [...rwaListings.values()].map(async (listing) => {
      const usd = await resolveQuoteUsdPrice(listing.address, listing.symbol, ethUsd, client);
      if (usd > 0) map.set(listing.address.toLowerCase(), usd);
    }),
  );

  return map;
}

export function quoteUsdFromMap(
  pool: Pick<TokenPool, "quoteAddress" | "quoteAsset">,
  ethUsd: number,
  map: Map<string, number>,
): number {
  const kind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  if (kind === "eth") return ethUsd;
  if (kind === "stable") return 1;
  const addr = pool.quoteAddress?.toLowerCase();
  if (addr && map.has(addr)) return map.get(addr)!;
  return fallbackStockUsd(pool.quoteAddress) || 1;
}

/** FDV in USD from spot quote-per-token and quote USD price. */
export function marketCapFromQuotePrice(
  quotePerToken: number,
  quoteUsd: number,
  totalSupply = TOTAL_SUPPLY,
): number {
  if (quotePerToken <= 0 || quoteUsd <= 0) return 0;
  return quotePerToken * totalSupply * quoteUsd;
}

export function marketCapUsdForPool(
  quotePerToken: number,
  pool: Pick<TokenPool, "quoteAddress" | "quoteAsset">,
  ethUsd: number,
  quoteUsd?: number,
): number {
  const kind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  if (kind === "eth") return marketCapUsd(quotePerToken, ethUsd);
  const qUsd =
    quoteUsd ??
    (pool.quoteAddress
      ? quoteUsdFromMap(pool, ethUsd, new Map())
      : kind === "stable"
        ? 1
        : fallbackStockUsd(pool.quoteAddress));
  return marketCapFromQuotePrice(quotePerToken, qUsd);
}

export function quoteVolumeUsd(
  volumeQuoteWei: bigint,
  pool: Pick<TokenPool, "quoteAddress" | "quoteAsset">,
  ethUsd: number,
  quoteUsd?: number,
): number {
  const kind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  const decimals = quoteDecimalsForKind(kind);
  const human = Number(volumeQuoteWei) / 10 ** decimals;
  if (kind === "eth") return human * ethUsd;
  const qUsd =
    quoteUsd ??
    (kind === "stable" ? 1 : fallbackStockUsd(pool.quoteAddress) || 1);
  return human * qUsd;
}

/** Scale indexer candle prices (quote per token) to FDV USD. */
export function candleFdvScale(
  pool: Pick<TokenPool, "quoteAddress" | "quoteAsset">,
  ethUsd: number,
  quoteUsd?: number,
): number {
  const kind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  if (kind === "eth") return TOTAL_SUPPLY * ethUsd;
  const qUsd =
    quoteUsd ??
    (kind === "stable" ? 1 : fallbackStockUsd(pool.quoteAddress) || 1);
  return TOTAL_SUPPLY * qUsd;
}
