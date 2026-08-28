import { createPublicClient, http } from "viem";

import { getActiveChain, getDefaultRpcUrl } from "@/lib/chains";

export function createServerPublicClient() {
  const chain = getActiveChain();
  return createPublicClient({
    chain,
    transport: http(getDefaultRpcUrl(), { timeout: 12_000 }),
  });
}
