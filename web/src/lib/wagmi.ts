import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { baseSepolia, ink, resolveHookitChainKey } from "@/lib/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  "00000000000000000000000000000000";

const primary = resolveHookitChainKey() === "ink" ? ink : baseSepolia;
const secondary = resolveHookitChainKey() === "ink" ? baseSepolia : ink;

const transports = {
  [ink.id]: http(process.env.NEXT_PUBLIC_INK_RPC_URL ?? "https://rpc-gel.inkonchain.com", {
    timeout: 10_000,
  }),
  [baseSepolia.id]: http(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    { timeout: 10_000 },
  ),
} as const;

/** Dev: injected wallet only — skips WalletConnect Cloud (403 / allowlist errors on localhost). */
function createDevConfig() {
  return createConfig({
    chains: [primary, secondary],
    transports,
    connectors: [injected({ shimDisconnect: true })],
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

export const wagmiConfig =
  process.env.NODE_ENV === "development" ? createDevConfig() : createProdConfig();
