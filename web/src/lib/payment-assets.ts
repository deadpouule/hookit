import { type Address, zeroAddress } from "viem";

import { USDC_ADDRESS } from "@/lib/contracts/config";
import { INK_XSTOCKS } from "@/lib/xstocks";
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
  { id: "USDC", label: "USDC", address: USDC_ADDRESS, decimals: 6 },
];

export function poolQuoteAddress(pool: TokenPool): Address {
  return (pool.quoteAddress ?? zeroAddress) as Address;
}

export function poolQuoteLabel(pool: TokenPool): string {
  const quote = poolQuoteAddress(pool);
  if (quote === zeroAddress) return "ETH";
  if (quote.toLowerCase() === USDC_ADDRESS.toLowerCase()) return "USDC";
  const x = INK_XSTOCKS.find((s) => s.address.toLowerCase() === quote.toLowerCase());
  return x?.symbol ?? `${quote.slice(0, 6)}…${quote.slice(-4)}`;
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
  return payment.address.toLowerCase() === poolQuoteAddress(pool).toLowerCase();
}

export function sortV4Currencies(a: Address, b: Address): [Address, Address] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}
