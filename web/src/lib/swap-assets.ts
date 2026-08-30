import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { stableQuoteLabel } from "@/lib/payment-assets";
import { shortAddress } from "@/lib/master-hooks";
import { resolveMediaUrl } from "@/lib/token-metadata";
import type { TokenPool } from "@/lib/types";

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

export function defaultSwapPair(
  pool: TokenPool,
  side: "buy" | "sell",
): { sell: SwapAsset; buy: SwapAsset } {
  const token = poolToSwapAsset(pool);
  if (side === "buy") {
    return { sell: NATIVE_ETH_ASSET, buy: token };
  }
  return { sell: token, buy: NATIVE_ETH_ASSET };
}
