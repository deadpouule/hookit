"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

function isBenignRuntimeNoise(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return (
    message.includes("has not been authorized") ||
    message.includes("Document is not focused") ||
    (message.includes("writeText") && message.includes("Clipboard"))
  );
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isBenignRuntimeNoise(event.reason)) return;
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
