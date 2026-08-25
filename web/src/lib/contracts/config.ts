import { type Address, zeroAddress } from "viem";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const POOL_MANAGER_ADDRESS =
  "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address;

export const STATE_VIEW_ADDRESS =
  "0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4" as Address;

export const V4_QUOTER_ADDRESS =
  "0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa" as Address;

export const POOL_SWAP_TEST_ADDRESS =
  "0x8B5bcC363ddE2614281aD875bad385E0A785D3B9" as Address;

/** Circle USDC on Base Sepolia. */
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

export const CHAINLINK_ETH_USD = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1" as Address;

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

/** Production router if deployed; otherwise PoolSwapTest on Base Sepolia. */
export function getSwapRouterAddress(): Address {
  const raw = process.env.NEXT_PUBLIC_SWAP_ROUTER?.trim();
  if (raw && raw !== "0x" && raw !== zeroAddress) return raw as Address;
  return POOL_SWAP_TEST_ADDRESS;
}

export function isProductionSwapRouter(): boolean {
  const raw = process.env.NEXT_PUBLIC_SWAP_ROUTER?.trim();
  return !!raw && raw !== "0x" && raw !== zeroAddress;
}

export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export const DEFAULT_TOTAL_SUPPLY = BigInt("1000000000000000000000000000");
export const DEFAULT_TICK_SPACING = 60;
export const DEFAULT_STARTING_TICK = 0;

export const MIN_SQRT_PRICE = BigInt("4295128739");
export const MAX_SQRT_PRICE = BigInt("1461446703485210103287273052203988822378723970342");

