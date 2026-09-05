import { createPublicClient, fallback, http } from "viem";

import { getActiveChain, getDefaultRpcUrl } from "@/lib/chains";
import { loadRepoEnv } from "@/lib/forge-env";

export function createServerPublicClient() {
  loadRepoEnv();
  const chain = getActiveChain();
  if (chain.id === 57_073) {
    const primary =
      process.env.INK_RPC_URL?.trim() ??
      process.env.NEXT_PUBLIC_INK_RPC_URL?.trim() ??
      "https://rpc-gel.inkonchain.com";
    const backup =
      process.env.INK_RPC_URL_BACKUP?.trim() ??
      process.env.NEXT_PUBLIC_INK_RPC_URL_BACKUP?.trim() ??
      "https://rpc-qnd.inkonchain.com";
    const urls = [primary, backup].filter((u, i, arr) => u && arr.indexOf(u) === i);
    const transports = urls.map((url) => http(url, { timeout: 12_000, retryCount: 0 }));
    return createPublicClient({
      chain,
      transport:
        transports.length === 1
          ? transports[0]!
          : fallback(transports, { rank: false, retryCount: 1 }),
    });
  }
  const url =
    process.env.BASE_SEPOLIA_RPC_URL?.trim() ??
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim() ??
    getDefaultRpcUrl();
  return createPublicClient({
    chain,
    transport: http(url, { timeout: 12_000 }),
  });
}
