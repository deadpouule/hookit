import { type Address, zeroAddress } from "viem";

import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { poolQuoteAddress, poolQuoteLabel, stableQuoteLabel } from "@/lib/payment-assets";
import { poolHasQuoteMarket } from "@/lib/pool-key";
import { shortAddress } from "@/lib/master-hooks";
import { isRwaQuote } from "@/lib/token-identity";
import { resolveMediaUrl } from "@/lib/token-metadata";
import type { TokenPool } from "@/lib/types";
import { INK_QUOTRON_STOCKS, quotronStockLogoUrl } from "@/lib/xstocks";

export type SwapAsset = {
  key: string;
  symbol: string;
  name: string;
  address?: `0x${string}`;
  imageUrl?: string;
  decimals: number;
  isNative?: boolean;
};

export const NATIVE_ETH_ASSET: SwapAsset = {
  key: "native-eth",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  isNative: true,
};

export const STABLE_SWAP_ASSET: SwapAsset = {
  key: "stable-usdg",
  symbol: stableQuoteLabel(),
  name: stableQuoteLabel(),
  address: STABLE_QUOTE_ADDRESS,
  imageUrl: "/pairing/usdg.png",
  decimals: 6,
};

export function isStableSwapAsset(asset: SwapAsset): boolean {
  return (
    !!asset.address &&
    asset.address.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()
  );
}

/** True when this market leg is quoted in a Quotrons wStock (not ETH/USDG). */
export function isStockQuotedPool(pool: TokenPool): boolean {
  return isRwaQuote(pool.quoteAsset, pool.quoteAddress);
}

export function poolToSwapAsset(pool: TokenPool): SwapAsset {
  return {
    key: pool.contractAddress ?? pool.id,
    symbol: pool.ticker,
    name: pool.name,
    address: pool.contractAddress as `0x${string}` | undefined,
    imageUrl: resolveMediaUrl(pool.image),
    decimals: 18,
  };
}

export function swapAssetLabel(asset: SwapAsset): string {
  if (asset.isNative) return asset.symbol;
  if (asset.address) return `${asset.symbol} ${shortAddress(asset.address)}`;
  return asset.symbol;
}

export function poolQuoteSwapAsset(pool: TokenPool): SwapAsset {
  const quote = poolQuoteAddress(pool);
  if (quote === zeroAddress) return NATIVE_ETH_ASSET;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return STABLE_SWAP_ASSET;
  const stock = INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === quote.toLowerCase());
  return {
    key: `quote-${quote.toLowerCase()}`,
    symbol: poolQuoteLabel(pool),
    name: stock?.name ?? poolQuoteLabel(pool),
    address: quote as Address,
    imageUrl: stock ? quotronStockLogoUrl(stock) : undefined,
    decimals: 18,
  };
}

/** True when this asset is the selected pool’s quote (ETH, USDG, or wStock). */
export function isPoolQuoteAsset(pool: TokenPool, asset: SwapAsset): boolean {
  const quote = poolQuoteAddress(pool);
  if (asset.isNative) return quote === zeroAddress;
  if (!asset.address) return false;
  return asset.address.toLowerCase() === quote.toLowerCase();
}

/** True when the receive leg matches the pool quote (single swap), including multi markets. */
export function isDirectPoolReceive(pool: TokenPool, receive: SwapAsset): boolean {
  const quote = poolQuoteAddress(pool);
  if (receive.isNative) {
    return quote === zeroAddress || poolHasQuoteMarket(pool, zeroAddress);
  }
  if (!receive.address) return false;
  if (receive.address.toLowerCase() === quote.toLowerCase()) return true;
  return poolHasQuoteMarket(pool, receive.address);
}

/**
 * Sell launch token for USDG/USDC via a bridge only when there is no direct stable market.
 * Multi launches that already include a USDG pool must sell on that leg (not stock → stable).
 */
export function needsCompositeSell(pool: TokenPool, receive: SwapAsset): boolean {
  if (!isStableSwapAsset(receive)) return false;
  if (poolHasQuoteMarket(pool, STABLE_QUOTE_ADDRESS)) return false;
  const quote = poolQuoteAddress(pool);
  if (quote === zeroAddress) return false;
  return quote.toLowerCase() !== STABLE_QUOTE_ADDRESS.toLowerCase();
}

/**
 * Default swap pair for the desk — trade the selected pool quote directly
 * (ETH, USDG, or wStock such as wMCDx). USDG remains available in the picker
 * for composite hops on stock-quoted legs.
 */
export function defaultSwapPair(
  pool: TokenPool,
  side: "buy" | "sell",
): { sell: SwapAsset; buy: SwapAsset } {
  const token = poolToSwapAsset(pool);
  const quote = poolQuoteSwapAsset(pool);
  if (side === "buy") return { sell: quote, buy: token };
  return { sell: token, buy: quote };
}
