import { type Address, zeroAddress } from "viem";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { getChainDeployment } from "@/lib/contracts/config";

export const STATE_VIEW_ADDRESS = getChainDeployment().stateView;

export const stateViewAbi = [
  {
    type: "function",
    name: "getSlot0",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidity",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
    stateMutability: "view",
  },
] as const;

const Q96 = BigInt(2) ** BigInt(96);

/**
 * Spot price in ETH per 1 whole token (18 decimals).
 * Hookit ETH launches use ETH as currency0 and token as currency1.
 */
export function ethPerTokenFromSqrtPrice(
  sqrtPriceX96: bigint,
  tokenIsCurrency0 = false,
): number {
  if (sqrtPriceX96 === BigInt(0)) return 0;

  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  const tokenPerEth = Number(priceX192) / Number(Q96 * Q96);

  if (tokenIsCurrency0) {
    return tokenPerEth > 0 ? tokenPerEth : 0;
  }
  return tokenPerEth > 0 ? 1 / tokenPerEth : 0;
}

export function marketCapEth(priceEth: number, totalSupply = 1_000_000_000): number {
  return priceEth * totalSupply;
}

export function marketCapUsd(priceEth: number, ethUsd = DEFAULT_LAUNCH_ETH_USD, totalSupply = 1_000_000_000): number {
  return marketCapEth(priceEth, totalSupply) * ethUsd;
}
