"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { WelcomeConnectModal } from "@/components/wallet/WelcomeConnectModal";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { HOOKIT_CHAIN_ID } from "@/lib/contracts/config";
import { shortenAddress } from "@/lib/format";
import { isPrivyConfigured } from "@/lib/privy";
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

type PrivySession = {
  ready: boolean;
  authenticated: boolean;
  logout: () => Promise<void>;
  address?: string;
  isConnected: boolean;
};

export function ConnectButton({
  className,
  compact = false,
  label,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  if (isPrivyConfigured()) {
    return <PrivyConnectButton className={className} compact={compact} label={label} />;
  }
  return <WalletConnectButton className={className} compact={compact} label={label} session={null} />;
}

function PrivyConnectButton({
  className,
  compact,
  label,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const { authenticated, ready, logout } = usePrivy();
  const { address, isConnected } = useAccount();
  return (
    <WalletConnectButton
      className={className}
      compact={compact}
      label={label}
      session={{ ready, authenticated, logout, address, isConnected }}
    />
  );
}

function WalletConnectButton({
  className,
  compact = false,
  label,
  session,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
  session: PrivySession | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
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
            : "rounded-md border border-white/15 bg-black px-4 py-1.5 text-sm text-zinc-100 disabled:opacity-50",
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
        mounted: rkMounted,
        authenticationStatus,
      }) => {
        const ready = rkMounted && authenticationStatus !== "loading";
        const rainbowConnected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");
        const privyConnecting = Boolean(
          session && session.ready && session.authenticated && !session.isConnected,
        );
        const connected = Boolean(rainbowConnected || (session?.authenticated && session.isConnected));
        const displayName =
          account?.displayName ??
          (session?.address ? shortenAddress(session.address) : "Connected");

        if (!connected) {
          return (
            <>
              <button
                type="button"
                onClick={() => setWelcomeOpen(true)}
                disabled={privyConnecting}
                {...TOOLBAR_BUTTON_PROPS}
                className={cn(
                  compact
                    ? "home-connect"
                    : "rounded-md border border-white/15 bg-black px-4 py-1.5 text-sm text-zinc-100 transition hover:bg-zinc-950",
                  className,
                )}
              >
                {compact ? <WalletMark /> : null}
                {compact ? (privyConnecting ? "…" : "Connect") : privyConnecting ? "Connecting" : (label ?? "Connect wallet")}
              </button>
              <WelcomeConnectModal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} />
            </>
          );
        }

        const chainId = chain?.id;
        const unsupported = chain?.unsupported || (chainId != null && chainId !== HOOKIT_CHAIN_ID);
        if (unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              {...TOOLBAR_BUTTON_PROPS}
              className={cn(
                compact
                  ? "home-connect home-connect--warn"
                  : "rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200 transition hover:bg-amber-500/20",
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
            onClick={() => {
              if (account) {
                openAccountModal();
                return;
              }
              if (session?.authenticated) {
                void session.logout();
              }
            }}
            {...TOOLBAR_BUTTON_PROPS}
            className={cn(
              compact
                ? "home-connect home-connect--connected font-mono"
                : "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black px-3 py-1.5 font-mono text-sm text-zinc-100 transition hover:bg-zinc-950",
              className,
            )}
          >
            <span className="home-connect-live-dot" aria-hidden />
            {displayName}
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
