"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { PrivySessionBridge } from "@/components/wallet/PrivySessionBridge";
import { getActiveChain } from "@/lib/chains";
import { isPrivyConfigured, PRIVY_APP_ID, privyConfig } from "@/lib/privy";
import { wagmiConfig } from "@/lib/wagmi";

const hookitTheme = darkTheme({
  accentColor: "#9514d1",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

function RainbowTree({ children }: { children: ReactNode }) {
  return (
    <RainbowKitProvider
      theme={hookitTheme}
      modalSize="wide"
      initialChain={getActiveChain()}
      appInfo={{
        appName: "hook it",
        learnMoreUrl: "https://github.com/deadpouule/hookit",
      }}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 8_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const rainbow = <RainbowTree>{children}</RainbowTree>;

  if (isPrivyConfigured()) {
    return (
      <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <PrivySessionBridge />
            {rainbow}
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {rainbow}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
