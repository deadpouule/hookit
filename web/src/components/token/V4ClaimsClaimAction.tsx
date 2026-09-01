"use client";

import { formatUnits, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import {
  getClaimsRedeemerAddress,
  POOL_MANAGER_ADDRESS,
} from "@/lib/contracts/config";
import { poolManagerClaimsAbi } from "@/lib/contracts/pool-manager-claims-abi";
import { v4ClaimsRedeemerAbi } from "@/lib/contracts/v4-claims-redeemer-abi";
import { quoteToCurrencyId } from "@/lib/currency-id";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Redeem PoolManager ERC-6909 quote claims (e.g. holder airdrop payouts) into spendable quote. */
export function V4ClaimsClaimAction({
  quote,
  decimals,
  quoteLabel,
  embedded = false,
  className,
}: {
  quote: Address;
  decimals: number;
  quoteLabel: string;
  embedded?: boolean;
  className?: string;
}) {
  const redeemer = getClaimsRedeemerAddress();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const currencyId = quoteToCurrencyId(quote);

  const { data: claimBalance, refetch: refetchBalance } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: poolManagerClaimsAbi,
    functionName: "balanceOf",
    args: address ? [address, currencyId] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const { data: isOperator } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: poolManagerClaimsAbi,
    functionName: "isOperator",
    args: address && redeemer ? [address, redeemer] : undefined,
    query: { enabled: !!address && !!redeemer },
  });

  const claimWei = (claimBalance as bigint | undefined) ?? BigInt(0);
  const claimHuman = formatUnits(claimWei, decimals);

  const claim = async () => {
    if (!redeemer || !address || claimWei <= BigInt(0)) return;
    try {
      if (!isOperator) {
        const opHash = await writeContractAsync({
          address: POOL_MANAGER_ADDRESS,
          abi: poolManagerClaimsAbi,
          functionName: "setOperator",
          args: [redeemer, true],
        });
        await publicClient?.waitForTransactionReceipt({ hash: opHash });
      }
      const hash = await writeContractAsync({
        address: redeemer,
        abi: v4ClaimsRedeemerAbi,
        functionName: "claim",
        args: [quote],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await refetchBalance();
      toast.success("Airdrop claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };

  if (!redeemer) return null;

  if (embedded) {
    if (claimWei <= BigInt(0)) return null;
    return (
      <div className={cn("token-hooks-chip-actions token-hooks-chip-actions--airdrop", className)}>
        <span className="token-hooks-vault-copy text-[11px] text-zinc-400">
          {claimHuman} {quoteLabel} to claim
        </span>
        <button
          type="button"
          disabled={!address || claimWei <= BigInt(0) || isPending}
          onClick={() => void claim()}
          className="token-hooks-vault-btn"
        >
          Claim
        </button>
      </div>
    );
  }

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-zinc-600">Your airdrop</p>
          <p className="font-mono text-sm text-zinc-100">
            {claimHuman} {quoteLabel}
          </p>
        </div>
        <button
          type="button"
          disabled={!address || claimWei <= BigInt(0) || isPending}
          onClick={() => void claim()}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 transition hover:border-[#9514d1] disabled:opacity-40"
        >
          Claim
        </button>
      </div>
      {claimWei <= BigInt(0) ? (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          After a payout swap, your share appears here as a v4 claim — claim to receive spendable{" "}
          {quoteLabel}.
        </p>
      ) : null}
    </div>
  );
}
