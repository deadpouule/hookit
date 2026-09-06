"use client";

import { useState } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import {
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
  STABLE_QUOTE_ADDRESS,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { feeEscrowAbi, graduatedFeeHookAbi } from "@/lib/contracts/swap-abi";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { toast } from "@/lib/toast";
import type { TokenPool } from "@/lib/types";

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
}

/** Compact fee amount: full precision stays in the title attribute. */
function formatFeeAmount(wei: bigint, decimals: number): string {
  if (wei === BigInt(0)) return "0";
  const value = Number(formatUnits(wei, decimals));
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return Number(value.toPrecision(6)).toString();
}

/** Creator fee claim — floor redeem lives inside ActiveHooksPanel / Backed floor. */
export function CreatorActions({ pool }: { pool: TokenPool }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState<string | null>(null);

  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  const isClassic = pool.rail === "classic";
  const isGraduatedClassic = isClassic && pool.bondingPhase !== 0;
  const isCreator =
    !!address && !!pool.creator && address.toLowerCase() === pool.creator.toLowerCase();
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);
  const poolId = pool.poolId as `0x${string}` | undefined;

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory && !isClassic },
  });

  const { data: classicFeeHook } = useReadContract({
    address: bonding,
    abi: bondingFactoryAbi,
    functionName: "feeHook",
    query: { enabled: !!bonding && isClassic },
  });

  const feeHookAddr = isClassic
    ? ((pool.hooksAddress as Address | undefined) ?? classicFeeHook)
    : masterHook;

  const { data: masterEscrow } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "feeEscrow",
    query: { enabled: !!masterHook && !isClassic },
  });

  const { data: classicEscrow } = useReadContract({
    address: feeHookAddr as Address | undefined,
    abi: graduatedFeeHookAbi,
    functionName: "escrow",
    query: { enabled: !!feeHookAddr && isClassic },
  });

  const escrow = (isClassic ? classicEscrow : masterEscrow) as Address | undefined;

  const { data: pendingOnHook, refetch: refetchPending } = useReadContract({
    address: feeHookAddr as Address | undefined,
    abi: graduatedFeeHookAbi,
    functionName: "pendingCreatorTax",
    args: poolId && isGraduatedClassic ? [poolId, quote] : undefined,
    query: { enabled: !!feeHookAddr && isGraduatedClassic && !!poolId },
  });

  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: escrow,
    abi: feeEscrowAbi,
    functionName: "balanceOf",
    args: address ? [address, quote] : undefined,
    query: { enabled: !!escrow && !!address, refetchInterval: 12_000 },
  });

  // Master custom hooks have no protocol escrow path here.
  if (!isClassic && pool.hooks.customHook) return null;
  if (!isCreator) return null;
  // Buyback vesting routes creator fees to BuybackVault — claim lives in ActiveHooksPanel.
  if (!isClassic && pool.hooks.buybackVesting) return null;

  const pendingWei = (pendingOnHook as bigint | undefined) ?? BigInt(0);
  const claimWei = claimable ?? BigInt(0);
  const needsSweep = isGraduatedClassic && pendingWei > BigInt(0);

  const syncFees = async () => {
    if (!feeHookAddr || !poolId) return;
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: feeHookAddr,
        abi: graduatedFeeHookAbi,
        functionName: "sweepQuote",
        args: [poolId],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await Promise.all([refetchPending(), refetchClaimable()]);
      setMessage("Fees synced to escrow");
      toast.success("Fees synced — you can claim now");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setMessage(msg);
      toast.error("Sync failed", msg.slice(0, 120));
    }
  };

  const claim = async () => {
    if (!escrow) return;
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: feeEscrowAbi,
        functionName: "claim",
        args: [quote],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await refetchClaimable();
      setMessage("Fees claimed");
      toast.success("Fees claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setMessage(msg);
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };


  return (
    <div className="desk-card space-y-3 border border-[#9514d1]/25 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-[#d8b4fe] uppercase">Creator fees</p>
        {claimWei > BigInt(0) ? (
          <span className="rounded-full bg-[#9514d1]/20 px-2 py-0.5 text-[10px] font-medium text-[#d8b4fe]">
            Claimable
          </span>
        ) : null}
      </div>

      {needsSweep ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div>
            <p className="text-xs text-amber-200/90">Unsynced fees</p>
            <p className="font-mono text-sm text-zinc-100">
              {formatFeeAmount(pendingWei, decimals)} {quoteLabel}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Classic pools accrue on the fee hook until synced to escrow.
            </p>
          </div>
          <button
            type="button"
            disabled={!feeHookAddr || !poolId || isPending}
            onClick={() => void syncFees()}
            className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-100 transition hover:border-amber-400 disabled:opacity-40"
          >
            Sync fees
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">Available to claim</p>
          <p className="truncate font-mono text-lg text-foreground" title={`${formatUnits(claimWei, decimals)} ${quoteLabel}`}>
            {formatFeeAmount(claimWei, decimals)} {quoteLabel}
          </p>
        </div>
        <button
          type="button"
          disabled={!escrow || claimWei === BigInt(0) || isPending}
          onClick={() => void claim()}
          className="shrink-0 rounded-lg bg-[#9514d1] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#a82be0] disabled:opacity-40"
        >
          Claim
        </button>
      </div>
      {message && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
