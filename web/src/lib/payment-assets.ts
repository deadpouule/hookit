import { type Address, zeroAddress } from "viem";

import { STABLE_QUOTE_ADDRESS, USDG_INK_ADDRESS } from "@/lib/contracts/config";
import { resolveHookitChainKey } from "@/lib/chains";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";
import type { TokenPool } from "@/lib/types";

export type PaymentAssetId = "ETH" | "USDC";

export type PaymentAsset = {
  id: PaymentAssetId;
  label: string;
  address: Address;
  decimals: number;
};

export const PAYMENT_ASSETS: PaymentAsset[] = [
  { id: "ETH", label: "ETH", address: zeroAddress, decimals: 18 },
  { id: "USDC", label: stableQuoteLabel(), address: STABLE_QUOTE_ADDRESS, decimals: 6 },
];

export function poolQuoteAddress(pool: TokenPool): Address {
  return (pool.quoteAddress ?? zeroAddress) as Address;
}

export function stableQuoteLabel(): string {
  return resolveHookitChainKey() === "ink" ? "USDG" : "USDC";
}

export function poolQuoteLabel(pool: TokenPool): string {
  const quote = poolQuoteAddress(pool);
  if (quote === zeroAddress) return "ETH";
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return stableQuoteLabel();
  if (quote.toLowerCase() === USDG_INK_ADDRESS.toLowerCase()) return "USDG";
  const stock = INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === quote.toLowerCase());
  return stock?.symbol ?? `${quote.slice(0, 6)}…${quote.slice(-4)}`;
}

export function paymentAssetById(id: PaymentAssetId): PaymentAsset {
  const asset = PAYMENT_ASSETS.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown payment asset: ${id}`);
  return asset;
}

/** Payment options shown on the buy panel (always ETH + USDC when different from pool quote). */
export function buyPaymentOptions(pool: TokenPool): PaymentAsset[] {
  const quote = poolQuoteAddress(pool).toLowerCase();
  return PAYMENT_ASSETS.filter((asset) => asset.address.toLowerCase() !== quote);
}

export function isDirectBuy(pool: TokenPool, payment: PaymentAsset): boolean {
  const pay = payment.address.toLowerCase();
  if (poolQuoteAddress(pool).toLowerCase() === pay) return true;
  return (pool.markets ?? []).some((m) => m.quoteAddress.toLowerCase() === pay);
}

export function sortV4Currencies(a: Address, b: Address): [Address, Address] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}
