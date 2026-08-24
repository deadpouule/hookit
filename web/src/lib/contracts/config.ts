import { type Address, zeroAddress } from "viem";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const POOL_MANAGER_ADDRESS =
  "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address;

/** Set via NEXT_PUBLIC_LAUNCH_FACTORY after deploy script. */
export function getLaunchFactoryAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_LAUNCH_FACTORY?.trim();
  if (!raw || raw === "0x" || raw === zeroAddress) return undefined;
  return raw as Address;
}

export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export const DEFAULT_TOTAL_SUPPLY = BigInt("1000000000000000000000000000");
export const DEFAULT_TICK_SPACING = 60;
export const DEFAULT_STARTING_TICK = 0;
