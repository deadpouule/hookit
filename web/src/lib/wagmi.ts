import { getDefaultConfig, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { createConfig as createPrivyWagmiConfig } from "@privy-io/wagmi";
import { createConfig, fallback, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { baseSepolia, ink, resolveHookitChainKey } from "@/lib/chains";
import { isPrivyConfigured } from "@/lib/privy";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  "00000000000000000000000000000000";

const primary = resolveHookitChainKey() === "ink" ? ink : baseSepolia;
const secondary = resolveHookitChainKey() === "ink" ? baseSepolia : ink;

function inkTransport() {
  if (typeof window !== "undefined") {
    // Paid provider credentials stay server-side behind the constrained proxy.
    return http("/api/rpc/ink", { timeout: 12_000, retryCount: 1 });
  }

  const primaryUrl =
    process.env.INK_RPC_URL?.trim() || "https://rpc-gel.inkonchain.com";
  const backupUrl =
    process.env.INK_RPC_URL_BACKUP?.trim() || "https://rpc-qnd.inkonchain.com";
  const tertiaryUrl = process.env.INK_RPC_URL_TERTIARY?.trim();
  const urls = [primaryUrl, backupUrl, tertiaryUrl].filter(
    (url): url is string => !!url,
  ).filter(
    (u, i, arr) => u && arr.indexOf(u) === i,
  );
  const transports = urls.map((url) => http(url, { timeout: 10_000, retryCount: 0 }));
  return transports.length === 1
    ? transports[0]!
    : fallback(transports, { rank: false, retryCount: 1 });
}

const transports = {
  [ink.id]: inkTransport(),
  [baseSepolia.id]: http(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    { timeout: 10_000 },
  ),
} as const;

function rainbowWalletConnectors() {
  return getDefaultWallets({
    appName: "hook it",
    projectId: walletConnectProjectId,
  }).connectors;
}

function injectedConnectors() {
  return [injected({ shimDisconnect: true })];
}

/** Dev: injected wallet only - skips WalletConnect Cloud (403 / allowlist errors on localhost). */
function createDevConfig() {
  return createConfig({
    chains: [primary, secondary],
    transports,
    connectors: injectedConnectors(),
    ssr: true,
  });
}

function createProdConfig() {
  return getDefaultConfig({
    appName: "hook it",
    projectId: walletConnectProjectId,
    chains: [primary, secondary],
    transports,
    ssr: true,
  });
}

/**
 * Privy drives the embedded wallet after email / Google / Twitter.
 * RainbowKit connectors stay on "Continue with a wallet" (MetaMask, Rabby, WC).
 */
function createPrivyHybridConfig() {
  return createPrivyWagmiConfig({
    chains: [primary, secondary],
    transports,
    connectors:
      process.env.NODE_ENV === "development"
        ? injectedConnectors()
        : rainbowWalletConnectors(),
    ssr: true,
  });
}

export const wagmiConfig = isPrivyConfigured()
  ? createPrivyHybridConfig()
  : process.env.NODE_ENV === "development"
    ? createDevConfig()
    : createProdConfig();
