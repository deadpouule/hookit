"use client";

import { useState } from "react";
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
import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER } from "@/lib/contracts/config";
import { cn } from "@/lib/utils";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton({ className }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [copied, setCopied] = useState(false);

  const wrongNetwork = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
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
            "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100",
            className,
          )}
        >
          {switching ? "Switching…" : "Switch network"}
        </button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-1.5 font-mono text-sm text-zinc-300 transition hover:border-ink-purple/30",
            className,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-degen-pink shadow-[0_0_8px_#ff2bd6]" />
          {truncate(address)}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 border-white/[0.08] bg-ink-elevated">
          <DropdownMenuItem onClick={copyAddress} className="gap-2 text-zinc-400">
            {copied ? <Check className="h-4 w-4 text-ink-lavender" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy address"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`${BASE_SEPOLIA_EXPLORER}/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2 text-zinc-400"
            >
              <ExternalLink className="h-4 w-4" />
              Basescan
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem onClick={() => disconnect()} className="gap-2 text-zinc-500">
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const connector = connectors[0];

  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      className={cn(
        "rounded-xl border border-white/[0.08] bg-black/40 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-ink-purple/30 disabled:opacity-50",
        className,
      )}
    >
      {isPending ? "Connecting…" : "Connect"}
    </button>
  );
}

export function useWalletReady() {
  const { isConnected, chainId } = useAccount();
  return isConnected && chainId === BASE_SEPOLIA_CHAIN_ID;
}
