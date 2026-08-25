"use client";

import { useState } from "react";
import { formatEther, parseUnits, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { feeEscrowAbi, floorVaultAbi } from "@/lib/contracts/swap-abi";
import type { TokenPool } from "@/lib/types";

export function CreatorActions({ pool }: { pool: TokenPool }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const factory = getLaunchFactoryAddress();
  const isCreator = !!address && !!pool.creator && address.toLowerCase() === pool.creator.toLowerCase();

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory },
  });

  const { data: escrow } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "feeEscrow",
    query: { enabled: !!masterHook },
  });

  const { data: vault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "floorVault",
    query: { enabled: !!masterHook && pool.hooks.backedFloor },
  });

  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: escrow,
    abi: feeEscrowAbi,
    functionName: "balanceOf",
    args: address ? [address, zeroAddress] : undefined,
    query: { enabled: !!escrow && !!address },
  });

  const { data: floorReserve } = useReadContract({
    address: vault,
    abi: floorVaultAbi,
    functionName: "reserve",
    args: pool.contractAddress ? [pool.contractAddress as Address] : undefined,
    query: { enabled: !!vault && !!pool.contractAddress && pool.hooks.backedFloor },
  });

  if (!pool.poolId || pool.hooks.customHook) return null;

  const claim = async () => {
    if (!escrow) return;
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: escrow,
        abi: feeEscrowAbi,
        functionName: "claim",
        args: [zeroAddress],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await refetchClaimable();
      setMessage("Fees claimed");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Claim failed");
    }
  };

  const redeem = async () => {
    if (!vault || !pool.contractAddress || !address) return;
    setMessage(null);
    try {
      const token = pool.contractAddress as Address;
      const amount = parseUnits(redeemAmount, 18);
      const allowance = (await publicClient?.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, vault],
      })) as bigint | undefined;
      if ((allowance ?? BigInt(0)) < amount) {
        const approveHash = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, amount],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      }
      const hash = await writeContractAsync({
        address: vault,
        abi: floorVaultAbi,
        functionName: "redeemFloor",
        args: [token, amount],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      setMessage("Floor redeemed");
      setRedeemAmount("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Redeem failed");
    }
  };

  const claimWei = claimable ?? BigInt(0);
  const reserveWei = floorReserve ?? BigInt(0);

  if (!isCreator && reserveWei === BigInt(0)) return null;

  return (
    <div className="panel mt-4 space-y-3 p-5">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Protocol</p>
      {isCreator && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">Creator fees</p>
            <p className="font-mono text-sm text-zinc-100">{formatEther(claimWei)} ETH</p>
          </div>
          <button
            type="button"
            disabled={!escrow || claimWei === BigInt(0) || isPending}
            onClick={claim}
            className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-40"
          >
            Claim
          </button>
        </div>
      )}
      {pool.hooks.backedFloor && reserveWei > BigInt(0) && (
        <div className="space-y-2 border-t border-white/[0.05] pt-3">
          <p className="text-xs text-zinc-500">
            Floor vault {formatEther(reserveWei)} ETH · redeem tokens at the ratchet
          </p>
          <div className="flex gap-2">
            <input
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder={`${pool.ticker} amount`}
              className="field-input h-9 flex-1 text-xs"
            />
            <button
              type="button"
              disabled={!redeemAmount || isPending}
              onClick={redeem}
              className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-40"
            >
              Redeem
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-zinc-400">{message}</p>}
    </div>
  );
}
