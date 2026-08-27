import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { baseSepolia, ink, resolveHookitChainKey } from "@/lib/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
  // Public WalletConnect Cloud placeholder — replace in production.
  "00000000000000000000000000000000";

const primary = resolveHookitChainKey() === "ink" ? ink : baseSepolia;
const secondary = resolveHookitChainKey() === "ink" ? baseSepolia : ink;

export const wagmiConfig = getDefaultConfig({
  appName: "hook it",
  projectId: walletConnectProjectId,
  chains: [primary, secondary],
  transports: {
    [ink.id]: http(
      process.env.NEXT_PUBLIC_INK_RPC_URL ?? "https://rpc-gel.inkonchain.com",
    ),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    ),
  },
  ssr: true,
});
