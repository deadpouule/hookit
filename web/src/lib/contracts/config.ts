import { type Address, zeroAddress } from "viem";

import { resolveHookitChainKey } from "@/lib/chains";

export type ChainDeployment = {
  chainId: number;
  poolManager: Address;
  stateView: Address;
  v4Quoter: Address;
  universalRouter: Address;
  poolSwapTest: Address;
  usdc: Address;
  ethUsdFeed: Address;
  explorer: string;
  networkLabel: string;
};

const BASE_SEPOLIA: ChainDeployment = {
  chainId: 84532,
  poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  stateView: "0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4",
  v4Quoter: "0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa",
  universalRouter: "0x492E6456D9528771018DeB9E87ef7750EF184104",
  poolSwapTest: "0x8B5bcC363ddE2614281aD875bad385E0A785D3B9",
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  ethUsdFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
  explorer: "https://sepolia.basescan.org",
  networkLabel: "Base Sepolia",
};

const INK_MAINNET: ChainDeployment = {
  chainId: 57073,
  poolManager: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
  stateView: "0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990",
  v4Quoter: "0x3972C00f7ed4885e145823eb7C655375d275A1C5",
  universalRouter: "0x112908daC86e20e7241B0927479Ea3Bf935d1fa0",
  poolSwapTest: zeroAddress,
  usdc: "0x2D270e6886d130D724215A266106e6832161EAEd",
  ethUsdFeed: "0xdFc720E1ef024bfc768ed9E6F0e7Fc80E28f8CFA",
  explorer: "https://explorer.inkonchain.com",
  networkLabel: "Ink",
};

export function getChainDeployment(): ChainDeployment {
  return resolveHookitChainKey() === "ink" ? INK_MAINNET : BASE_SEPOLIA;
}

export const HOOKIT_CHAIN_ID = getChainDeployment().chainId;

/** @deprecated use getChainDeployment().explorer */
export const BLOCK_EXPLORER_URL = getChainDeployment().explorer;

/** @deprecated use HOOKIT_CHAIN_ID */
export const BASE_SEPOLIA_CHAIN_ID = BASE_SEPOLIA.chainId;

/** @deprecated use BLOCK_EXPLORER_URL */
export const BASE_SEPOLIA_EXPLORER = BASE_SEPOLIA.explorer;

export const POOL_MANAGER_ADDRESS = getChainDeployment().poolManager;
export const STATE_VIEW_ADDRESS = getChainDeployment().stateView;
export const V4_QUOTER_ADDRESS = getChainDeployment().v4Quoter;
export const UNIVERSAL_ROUTER_ADDRESS = getChainDeployment().universalRouter;
export const POOL_SWAP_TEST_ADDRESS = getChainDeployment().poolSwapTest;
export const USDC_ADDRESS = getChainDeployment().usdc;
export const CHAINLINK_ETH_USD = getChainDeployment().ethUsdFeed;

export const chainlinkAggregatorAbi = [
  {
    type: "function",
    name: "latestRoundData",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
  },
] as const;

/** Set via NEXT_PUBLIC_LAUNCH_FACTORY after deploy script. */
export function getLaunchFactoryAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_LAUNCH_FACTORY?.trim();
  if (!raw || raw === "0x" || raw === zeroAddress) return undefined;
  return raw as Address;
}

/** Hookit router for hooked pools. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER after deploy. */
export function getHookitSwapRouterAddress(): Address | undefined {
  const raw =
    process.env.NEXT_PUBLIC_HOOKIT_SWAP_ROUTER?.trim() ??
    process.env.NEXT_PUBLIC_SWAP_ROUTER?.trim();
  if (!raw || raw === "0x" || raw === zeroAddress) return undefined;
  return raw as Address;
}

/** Production router if deployed; otherwise Universal Router (Ink) or PoolSwapTest (Sepolia). */
export function getSwapRouterAddress(): Address {
  const hookit = getHookitSwapRouterAddress();
  if (hookit) return hookit;

  const d = getChainDeployment();
  if (d.chainId === INK_MAINNET.chainId) return d.universalRouter;
  return d.poolSwapTest;
}

export function isProductionSwapRouter(): boolean {
  return !!getHookitSwapRouterAddress();
}

export function supportsCompositeSwap(): boolean {
  return isProductionSwapRouter();
}

export const DEFAULT_TOTAL_SUPPLY = BigInt("1000000000000000000000000000");
export const DEFAULT_TICK_SPACING = 60;
export const DEFAULT_STARTING_TICK = 0;

export const MIN_SQRT_PRICE = BigInt("4295128739");
export const MAX_SQRT_PRICE = BigInt("1461446703485210103287273052203988822378723970342");
