import { createPublicClient, http } from "viem";

import { getActiveChain, getDefaultRpcUrl } from "@/lib/chains";
import { loadRepoEnv } from "@/lib/forge-env";

export function createServerPublicClient() {
  loadRepoEnv();
  const chain = getActiveChain();
  const url =
    chain.id === 57_073
      ? (process.env.INK_RPC_URL?.trim() ??
        process.env.NEXT_PUBLIC_INK_RPC_URL?.trim() ??
        getDefaultRpcUrl())
      : (process.env.BASE_SEPOLIA_RPC_URL?.trim() ??
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim() ??
        getDefaultRpcUrl());
  return createPublicClient({
    chain,
    transport: http(url, { timeout: 12_000 }),
  });
}
