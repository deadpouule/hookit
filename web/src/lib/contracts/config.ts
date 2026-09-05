import { getAddress, isAddress, type Address, zeroAddress } from "viem";

import { resolveHookitChainKey } from "@/lib/chains";

/**
 * Normalize env addresses for viem. Mixed-case strings with a wrong EIP-55 checksum
 * (common when copying forge/broadcast output) fail writeContract — lowercase then checksum.
 */
function parseEnvAddress(raw: string | undefined): Address | undefined {
  const v = raw?.trim();
  if (!v || v === "0x" || v.toLowerCase() === zeroAddress) return undefined;
  if (!isAddress(v, { strict: false })) return undefined;
  return getAddress(v.toLowerCase() as Address);
}

/** Paxos USDG on Ink mainnet (6 decimals). */
export const USDG_INK_ADDRESS = "0xe343167631d89B6Ffc58B88d6b7fB0228795491D" as const;

export type ChainDeployment = {
  chainId: number;
  poolManager: Address;
  stateView: Address;
  v4Quoter: Address;
  universalRouter: Address;
  poolSwapTest: Address;
  /** USDG on Ink; Base Sepolia USDC as 6-decimal testnet stand-in. */
  stableQuote: Address;
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
  stableQuote: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
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
  stableQuote: USDG_INK_ADDRESS,
  ethUsdFeed: "0xe5867B1d421f0b52697F16e2ac437e87d66D5fbF", // RedStone ETH/USD (Ink)
  explorer: "https://explorer.inkonchain.com",
  networkLabel: "Ink",
};

export function getChainDeployment(): ChainDeployment {
  return resolveHookitChainKey() === "ink" ? INK_MAINNET : BASE_SEPOLIA;
}

export const HOOKIT_CHAIN_ID = getChainDeployment().chainId;

/** Active chain explorer (Ink or Base Sepolia). */
export const BLOCK_EXPLORER_URL = getChainDeployment().explorer;

/** @deprecated use HOOKIT_CHAIN_ID */
export const BASE_SEPOLIA_CHAIN_ID = HOOKIT_CHAIN_ID;

/** @deprecated use BLOCK_EXPLORER_URL */
export const BASE_SEPOLIA_EXPLORER = BLOCK_EXPLORER_URL;

export const POOL_MANAGER_ADDRESS = getChainDeployment().poolManager;
export const STATE_VIEW_ADDRESS = getChainDeployment().stateView;
export const V4_QUOTER_ADDRESS = getChainDeployment().v4Quoter;
export const UNIVERSAL_ROUTER_ADDRESS = getChainDeployment().universalRouter;
export const POOL_SWAP_TEST_ADDRESS = getChainDeployment().poolSwapTest;
export const STABLE_QUOTE_ADDRESS = getChainDeployment().stableQuote;
/** @deprecated use STABLE_QUOTE_ADDRESS */
export const USDC_ADDRESS = STABLE_QUOTE_ADDRESS;
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
  return parseEnvAddress(process.env.NEXT_PUBLIC_LAUNCH_FACTORY);
}

/** Paginated launch index — set NEXT_PUBLIC_LAUNCH_FACTORY_QUERY after deploy. */
export function getLaunchFactoryQueryAddress(): Address | undefined {
  return parseEnvAddress(process.env.NEXT_PUBLIC_LAUNCH_FACTORY_QUERY);
}

/** Classic bonding rail. Set NEXT_PUBLIC_BONDING_FACTORY after deploy. */
export function getBondingFactoryAddress(): Address | undefined {
  return parseEnvAddress(process.env.NEXT_PUBLIC_BONDING_FACTORY);
}

export function isFactoryConfigured(): boolean {
  return !!getLaunchFactoryAddress() || !!getBondingFactoryAddress();
}

/** Hookit router for hooked pools. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER after deploy. */
export function getHookitSwapRouterAddress(): Address | undefined {
  return (
    parseEnvAddress(process.env.NEXT_PUBLIC_HOOKIT_SWAP_ROUTER) ??
    parseEnvAddress(process.env.NEXT_PUBLIC_SWAP_ROUTER)
  );
}

/** ProtocolRevenueDistributor — set after DeployHookitCore. */
export function getProtocolDistributorAddress(): Address | undefined {
  return (
    parseEnvAddress(process.env.NEXT_PUBLIC_PROTOCOL_DISTRIBUTOR) ??
    parseEnvAddress(process.env.NEXT_PUBLIC_REVENUE_DISTRIBUTOR)
  );
}

/** V4ClaimsRedeemer — redeems PoolManager ERC-6909 airdrop claims. Set after DeployHookitCore. */
export function getClaimsRedeemerAddress(): Address | undefined {
  return parseEnvAddress(process.env.NEXT_PUBLIC_CLAIMS_REDEEMER);
}

/** HkitBuyback keeper — set after DeployHookitCore. */
export function getHkitBuybackAddress(): Address | undefined {
  return (
    parseEnvAddress(process.env.NEXT_PUBLIC_HKIT_BUYBACK) ??
    parseEnvAddress(process.env.NEXT_PUBLIC_HOOK_BUYBACK)
  );
}

/** Fair-launched native token (HKIT / HOOKTEST). */
export function getNativeTokenAddress(): Address | undefined {
  return (
    parseEnvAddress(process.env.NEXT_PUBLIC_NATIVE_TOKEN) ??
    parseEnvAddress(process.env.NEXT_PUBLIC_HKIT_TOKEN)
  );
}

/**
 * Swap entrypoint for Hookit pools.
 * - Prefer HookitSwapRouter when set (required on Ink; needed for hooked fee accounting).
 * - Base Sepolia only: fall back to PoolSwapTest for local/integration without a router deploy.
 * Never fall back to Universal Router — hooked pools need HookitSwapRouter.
 */
export function getSwapRouterAddress(): Address {
  const hookit = getHookitSwapRouterAddress();
  if (hookit) return hookit;

  const d = getChainDeployment();
  if (d.chainId === INK_MAINNET.chainId) {
    throw new Error(
      "HookitSwapRouter not configured. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER after DeployHookitCore on Ink.",
    );
  }
  if (d.poolSwapTest === zeroAddress) {
    throw new Error("No swap router: set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER or deploy PoolSwapTest.");
  }
  return d.poolSwapTest;
}

export function isProductionSwapRouter(): boolean {
  return !!getHookitSwapRouterAddress();
}

/** True when this chain can swap without HookitSwapRouter (Base Sepolia PoolSwapTest only). */
export function canUseDevSwapFallback(): boolean {
  const d = getChainDeployment();
  return d.chainId !== INK_MAINNET.chainId && d.poolSwapTest !== zeroAddress;
}

export function supportsCompositeSwap(): boolean {
  return isProductionSwapRouter();
}

export const DEFAULT_TOTAL_SUPPLY = BigInt("1000000000000000000000000000");
export const DEFAULT_TICK_SPACING = 60;
export const DEFAULT_STARTING_TICK = 0;

/** Measured on Ink — single `launch` ~2.5M; `launchMulti` ~3.7M for 3 RWA markets. */
export const LAUNCH_GAS_SINGLE = 3_000_000n;
export const LAUNCH_GAS_MULTI_BASE = 2_800_000n;
export const LAUNCH_GAS_PER_EXTRA_MARKET = 950_000n;

/** Minimum gas limit wallets should use (estimateLaunchGas applies +25% on top when RPC succeeds). */
export function launchGasFloor(isMulti: boolean, marketCount = 1): bigint {
  if (!isMulti) return LAUNCH_GAS_SINGLE;
  const extra = Math.max(0, marketCount - 1);
  return LAUNCH_GAS_MULTI_BASE + BigInt(extra) * LAUNCH_GAS_PER_EXTRA_MARKET;
}

export const MIN_SQRT_PRICE = BigInt("4295128739");
export const MAX_SQRT_PRICE = BigInt("1461446703485210103287273052203988822378723970342");
