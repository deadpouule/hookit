"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";

import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { HOOKIT_CHAIN_ID } from "@/lib/contracts/config";
import { cn } from "@/lib/utils";

function WalletMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function ConnectButton({
  className,
  compact = false,
  label,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        {...TOOLBAR_BUTTON_PROPS}
        className={cn(
          compact
            ? "home-connect disabled:opacity-50"
            : "rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-sm text-zinc-100 disabled:opacity-50",
          className,
        )}
      >
        {compact ? <WalletMark /> : null}
        {compact ? "Connect" : (label ?? "Connect wallet")}
      </button>
    );
  }

  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted: rkMounted,
        authenticationStatus,
      }) => {
        const ready = rkMounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              {...TOOLBAR_BUTTON_PROPS}
              className={cn(
                compact
                  ? "home-connect"
                  : "rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-sm text-zinc-100 transition hover:bg-white/[0.08]",
                className,
              )}
            >
              {compact ? <WalletMark /> : null}
              {compact ? "Connect" : (label ?? "Connect wallet")}
            </button>
          );
        }

        if (chain.unsupported || chain.id !== HOOKIT_CHAIN_ID) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              {...TOOLBAR_BUTTON_PROPS}
              className={cn(
                "rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200 transition hover:bg-amber-500/20",
                className,
              )}
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            {...TOOLBAR_BUTTON_PROPS}
            className={cn(
              compact
                ? "home-connect font-mono"
                : "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-zinc-100 transition hover:bg-white/[0.08]",
              className,
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#9514d1] shadow-[0_0_8px_rgba(149,20,209,0.55)]" />
            {account.displayName}
          </button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

export function useWalletReady() {
  const { isConnected, chainId } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted && isConnected && chainId === HOOKIT_CHAIN_ID;
}
