import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export function createServerPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
        process.env.BASE_SEPOLIA_RPC_URL ??
        "https://sepolia.base.org",
    ),
  });
}
