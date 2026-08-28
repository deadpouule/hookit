import { defineChain } from "viem";

/** Same CREATE2 Multicall3 used across OP-stack / Base / most EVM L2s. */
const MULTICALL3 = {
  address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const,
  blockCreated: 0,
};

/** Production mainnet — Uniswap v4 + Universal Router. */
export const ink = defineChain({
  id: 57_073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ink Explorer",
      url: "https://explorer.inkonchain.com",
    },
  },
  contracts: {
    multicall3: MULTICALL3,
  },
});

/** Integration testnet — v4 PoolManager + PoolSwapTest; no Ink Sepolia router. */
export const baseSepolia = defineChain({
  id: 84_532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
          process.env.BASE_SEPOLIA_RPC_URL ??
          "https://sepolia.base.org",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Basescan",
      url: "https://sepolia.basescan.org",
    },
  },
  contracts: {
    multicall3: MULTICALL3,
  },
  testnet: true,
});

export type HookitChainKey = "ink" | "baseSepolia";

export function resolveHookitChainKey(): HookitChainKey {
  const raw = process.env.NEXT_PUBLIC_HOOKIT_CHAIN?.trim().toLowerCase();
  if (raw === "ink" || raw === "57073") return "ink";
  if (raw === "basesepolia" || raw === "base_sepolia" || raw === "84532") return "baseSepolia";
  return "ink";
}

export function getActiveChain() {
  return resolveHookitChainKey() === "ink" ? ink : baseSepolia;
}

export function getActiveChainId() {
  return getActiveChain().id;
}

export function getBlockExplorerUrl() {
  return getActiveChain().blockExplorers.default.url;
}

export function getDefaultRpcUrl() {
  return getActiveChain().rpcUrls.default.http[0]!;
}

export function getNetworkLabel() {
  return resolveHookitChainKey() === "ink" ? "Ink" : "Base Sepolia";
}

export function getNetworkSubtitle() {
  return resolveHookitChainKey() === "ink"
    ? "Uniswap v4 · Hookit-native · Ink mainnet"
    : "Uniswap v4 · Hookit-native · Base Sepolia (testnet)";
}
