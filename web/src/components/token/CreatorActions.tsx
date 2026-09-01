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

/** Creator fee claim — floor redeem lives inside ActiveHooksPanel / Backed floor. */
export function CreatorActions({ pool }: { pool: TokenPool }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState<string | null>(null);

  const factory = getLaunchFactoryAddress();
  const bonding = getBondingFactoryAddress();
  const isClassic = pool.rail === "classic";
  const isCreator =
    !!address && !!pool.creator && address.toLowerCase() === pool.creator.toLowerCase();
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);

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

  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: escrow,
    abi: feeEscrowAbi,
    functionName: "balanceOf",
    args: address ? [address, quote] : undefined,
    query: { enabled: !!escrow && !!address },
  });

  // Master custom hooks have no protocol escrow path here.
  if (!isClassic && pool.hooks.customHook) return null;
  if (isClassic && pool.bondingPhase === 0) return null;
  if (!isCreator) return null;
  // Buyback vesting routes creator fees to BuybackVault — claim lives in ActiveHooksPanel.
  if (!isClassic && pool.hooks.buybackVesting) return null;

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

  const claimAllQuotes = async () => {
    if (!escrow) return;
    setMessage(null);
    try {
      const currencies = Array.from(
        new Set([quote, zeroAddress, STABLE_QUOTE_ADDRESS].map((c) => c.toLowerCase())),
      ) as Address[];
      const hash = await writeContractAsync({
        address: escrow,
        abi: feeEscrowAbi,
        functionName: "claimAll",
        args: [currencies],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await refetchClaimable();
      setMessage("All quote fees claimed");
      toast.success("All quote fees claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setMessage(msg);
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };

  const claimWei = claimable ?? BigInt(0);

  return (
    <div className="desk-card mt-3 space-y-3 p-4">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Creator</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Creator fees</p>
          <p className="font-mono text-sm text-zinc-100">
            {formatUnits(claimWei, decimals)} {quoteLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!escrow || claimWei === BigInt(0) || isPending}
            onClick={() => void claim()}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 transition hover:border-[#9514d1] disabled:opacity-40"
          >
            Claim
          </button>
          <button
            type="button"
            disabled={!escrow || isPending}
            onClick={() => void claimAllQuotes()}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:border-[#9514d1] disabled:opacity-40"
            title="Claim ETH + stable quote balances"
          >
            Claim all
          </button>
        </div>
      </div>
      {message && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
