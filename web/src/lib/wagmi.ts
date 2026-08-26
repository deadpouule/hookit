import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { baseSepolia, ink } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: [ink, baseSepolia],
  connectors: [injected()],
  transports: {
    [ink.id]: http(process.env.NEXT_PUBLIC_INK_RPC_URL ?? "https://rpc-gel.inkonchain.com"),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    ),
  },
  ssr: true,
});
