"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";

import { BASE_SEPOLIA_CHAIN_ID } from "@/lib/contracts/config";
import { cn } from "@/lib/utils";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton({ className }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

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
      <button
        type="button"
        onClick={() => disconnect()}
        className={cn(
          "rounded-full border border-white/15 bg-transparent px-4 py-1.5 font-mono text-sm text-zinc-100 transition hover:bg-white/5",
          className,
        )}
      >
        {truncate(address)}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      className={cn(
        "rounded-full border border-white/15 bg-transparent px-4 py-1.5 text-sm text-zinc-100 transition hover:bg-white/5 disabled:opacity-50",
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
