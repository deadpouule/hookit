import { type Address, zeroAddress } from "viem";

/** Uniswap v4 ERC-6909 currency id (uint160 of token address; native = 0). */
export function quoteToCurrencyId(quote: Address): bigint {
  if (!quote || quote === zeroAddress) return BigInt(0);
  return BigInt(quote);
}
