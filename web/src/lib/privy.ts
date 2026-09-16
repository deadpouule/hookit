import type { PrivyClientConfig } from "@privy-io/react-auth";

import { baseSepolia, getActiveChain, ink } from "@/lib/chains";

/** Dashboard app ID. Not a secret — it ships in the client bundle. */
export const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || "cmu3yl60508zd0dl60itcihgy";

/** Email, SMS, passkey, Google, Twitter. External wallets stay on RainbowKit so they are not Privy MAUs. */
export const PRIVY_LOGIN_METHODS = ["email", "sms", "passkey", "google", "twitter"] as const;

export function isPrivyConfigured(): boolean {
  return PRIVY_APP_ID.length > 0;
}

export const privyConfig: PrivyClientConfig = {
  loginMethods: [...PRIVY_LOGIN_METHODS],
  defaultChain: getActiveChain(),
  supportedChains: [ink, baseSepolia],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
    showWalletUIs: true,
  },
  appearance: {
    theme: "dark",
    accentColor: "#9514d1",
    logo: "/brand/hookit-owl-favicon.png",
    walletChainType: "ethereum-only",
  },
};

/** Hide the Privy embedded connector from "Continue with a wallet". */
export function isPrivyWagmiConnector(connector: {
  id: string;
  name: string;
  type?: string;
}): boolean {
  const blob = `${connector.id} ${connector.name} ${connector.type ?? ""}`.toLowerCase();
  return blob.includes("privy");
}
