"use client";

import { useEffect, useState } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { PoolQuoteMark } from "@/components/token/PoolQuoteMark";
import { fetchCreatorClaimedTotal, invalidateCreatorClaimed } from "@/lib/creator-fees-claimed";

import {
  getBondingFactoryAddress,
  STABLE_QUOTE_ADDRESS,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { feeEscrowAbi, graduatedFeeHookAbi } from "@/lib/contracts/swap-abi";
import { shortAddress } from "@/lib/master-hooks";
import { compactQuoteLabel, poolQuoteLabel } from "@/lib/payment-assets";
import { formatCompactQuoteAmount } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
}

/** Compact fee amount: full precision stays in the title attribute. */
function formatFeeAmount(wei: bigint, decimals: number): string {
  if (wei === BigInt(0)) return "0";
  return formatCompactQuoteAmount(Number(formatUnits(wei, decimals)));
}

function FeeQuoteAmount({
  amount,
  pool,
  quoteLabel,
  className,
}: {
  amount: string;
  pool: TokenPool;
  quoteLabel: string;
  className?: string;
}) {
  const ticker = compactQuoteLabel(quoteLabel);
  return (
    <span
      className={cn("flex w-full min-w-0 items-center gap-1.5 overflow-hidden", className)}
      title={`${amount} ${quoteLabel}`}
    >
      <span className="inline-flex shrink-0" aria-hidden>
        <PoolQuoteMark
          quoteAddress={pool.quoteAddress ?? zeroAddress}
          quoteAsset={pool.quoteAsset ?? quoteLabel}
        />
      </span>
      <span className="min-w-0 truncate">
        {amount}{" "}
        <span className="text-[0.92em] tracking-tight">{ticker}</span>
      </span>
    </span>
  );
}

/** Creator fee claim — floor redeem lives inside ActiveHooksPanel / Backed floor. */
export function CreatorActions({ pool }: { pool: TokenPool }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState<string | null>(null);

  const bonding = getBondingFactoryAddress();
  const isClassic = pool.rail === "classic";
  const isGraduatedClassic = isClassic && pool.bondingPhase !== 0;
  const creator = pool.creator as Address | undefined;
  const isCreator = !!address && !!creator && address.toLowerCase() === creator.toLowerCase();
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);
  const poolId = pool.poolId as `0x${string}` | undefined;
  const masterHook = !isClassic ? (pool.hooksAddress as Address | undefined) : undefined;

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
    args: creator ? [creator, quote] : undefined,
    query: { enabled: !!escrow && !!creator, refetchInterval: 12_000 },
  });

  const [claimedTotal, setClaimedTotal] = useState<bigint | null>(null);
  const [claimedNonce, setClaimedNonce] = useState(0);
  useEffect(() => {
    if (!publicClient || !escrow || !creator) return;
    let cancelled = false;
    fetchCreatorClaimedTotal(publicClient, escrow, creator, quote, pool.launchedAt)
      .then((total) => {
        if (!cancelled) setClaimedTotal(total);
      })
      .catch(() => {
        if (!cancelled) setClaimedTotal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicClient, escrow, creator, quote, pool.launchedAt, claimedNonce]);

  // Master custom hooks have no protocol escrow path here.
  if (!isClassic && pool.hooks.customHook) return null;
  if (!creator) return null;

  const feesToHooks = !isClassic && !!pool.hooks.creatorShareToHook;
  // Buyback vesting routes creator fees to BuybackVault — claim lives in ActiveHooksPanel.
  const feesVesting = !isClassic && !!pool.hooks.buybackVesting;

  const pendingWei = (pendingOnHook as bigint | undefined) ?? BigInt(0);
  const claimWei = claimable ?? BigInt(0);
  const needsSweep = isGraduatedClassic && pendingWei > BigInt(0);
  const afterClaim = () => {
    if (escrow && creator) invalidateCreatorClaimed(escrow, creator, quote);
    setClaimedNonce((n) => n + 1);
  };

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
      afterClaim();
      setMessage("Fees claimed");
      toast.success("Fees claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setMessage(msg);
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };


  return (
    <div className="desk-card min-w-0 space-y-3 overflow-hidden border border-[#9514d1]/25 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-[#d8b4fe] uppercase">Creator fees</p>
        {isCreator ? (
          <span className="rounded-full bg-[#9514d1]/20 px-2 py-0.5 text-[10px] font-medium text-[#d8b4fe]">
            You
          </span>
        ) : (
          <span className="font-mono text-[10px] text-zinc-500" title={creator}>
            {shortAddress(creator)}
          </span>
        )}
      </div>

      {feesToHooks ? (
        <p className="rounded-lg border border-[#9514d1]/20 bg-[#9514d1]/10 px-3 py-2 text-[12px] leading-snug text-zinc-300">
          Creator hook is on — the creator&apos;s fee share is routed into the hook modules instead of
          this escrow.
        </p>
      ) : null}

      {feesVesting ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-zinc-400">
          Fees vest through the Buyback vault — see the Buyback hook in Active hooks.
        </p>
      ) : null}

      {needsSweep ? (
        <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-xs text-amber-200/90">Unsynced fees</p>
            <p className="min-w-0 font-mono text-sm text-zinc-100">
              <FeeQuoteAmount
                amount={formatFeeAmount(pendingWei, decimals)}
                pool={pool}
                quoteLabel={quoteLabel}
              />
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Classic pools accrue on the fee hook until synced to escrow.
            </p>
          </div>
          {isCreator ? (
            <button
              type="button"
              disabled={!feeHookAddr || !poolId || isPending}
              onClick={() => void syncFees()}
              className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-100 transition hover:border-amber-400 disabled:opacity-40"
            >
              Sync fees
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-xs text-zinc-500">{isCreator ? "Available to claim" : "Unclaimed"}</p>
          <p
            className="min-w-0 font-mono text-base text-foreground"
            title={`${formatUnits(claimWei, decimals)} ${quoteLabel}`}
          >
            <FeeQuoteAmount
              amount={formatFeeAmount(claimWei, decimals)}
              pool={pool}
              quoteLabel={quoteLabel}
            />
          </p>
        </div>
        {isCreator ? (
          <button
            type="button"
            disabled={!escrow || claimWei === BigInt(0) || isPending}
            onClick={() => void claim()}
            className="shrink-0 rounded-lg bg-[#9514d1] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#a82be0] disabled:opacity-40"
          >
            Claim
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden border-t border-white/[0.06] pt-2.5">
        <p className="shrink-0 text-xs text-zinc-500">Claimed so far</p>
        <p
          className="min-w-0 flex-1 overflow-hidden font-mono text-sm text-zinc-200"
          title={claimedTotal != null ? `${formatUnits(claimedTotal, decimals)} ${quoteLabel}` : undefined}
        >
          <FeeQuoteAmount
            amount={claimedTotal == null ? "…" : formatFeeAmount(claimedTotal, decimals)}
            pool={pool}
            quoteLabel={quoteLabel}
            className="justify-end"
          />
        </p>
      </div>
      {message && isCreator && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
