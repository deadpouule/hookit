"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Check, ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard } from "@/lib/clipboard";
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER } from "@/lib/contracts/config";
import { cn } from "@/lib/utils";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ConnectPlaceholder({
  className,
  compact = false,
  label,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled
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

function ConnectButtonLive({
  className,
  compact = false,
  label,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [copied, setCopied] = useState(false);

  const wrongNetwork = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

  const copyAddress = async () => {
    if (!address) return;
    if (!(await copyToClipboard(address))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isConnected && address) {
    if (wrongNetwork) {
      return (
        <button
          type="button"
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          disabled={switching}
          className={cn(
            "rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200 transition hover:bg-amber-500/20",
            className,
          )}
        >
          {switching ? "Switching…" : "Switch to Base Sepolia"}
        </button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            compact
              ? "home-connect font-mono"
              : "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-zinc-100 transition hover:bg-white/[0.08] data-[state=open]:bg-white/[0.08]",
            className,
          )}
        >
          <span className="h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_8px_rgba(212,255,0,0.5)]" />
          {truncate(address)}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-white/10 bg-zinc-950">
          <DropdownMenuItem onClick={copyAddress} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy address"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`${BASE_SEPOLIA_EXPLORER}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on Basescan
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => disconnect()} className="gap-2 text-red-300">
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const connector =
    connectors.find((item) => item.id === "metaMask") ??
    connectors.find((item) => item.id === "injected") ??
    connectors.find((item) => !item.id.toLowerCase().includes("coinbase")) ??
    connectors[0];

  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() =>
        connector &&
        connect(
          { connector },
          {
            onError(error) {
              if (error.message.includes("has not been authorized")) return;
            },
          },
        )
      }
      className={cn(
        compact
          ? "home-connect disabled:opacity-50"
          : "rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-sm text-zinc-100 transition hover:bg-white/[0.08] disabled:opacity-50",
        className,
      )}
    >
      {compact ? <WalletMark /> : null}
      {isPending ? "Connecting…" : compact ? "Connect" : (label ?? "Connect wallet")}
    </button>
  );
}

export function ConnectButton(props: {
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  // wagmi's useAccount uses useSyncExternalStore — never call it during SSR/hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ConnectPlaceholder {...props} />;
  }

  return <ConnectButtonLive {...props} />;
}

export function useWalletReady() {
  const { isConnected, chainId } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted && isConnected && chainId === BASE_SEPOLIA_CHAIN_ID;
}
