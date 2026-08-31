"use client";

import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { toast } from "@/lib/toast";
import type { TokenPool } from "@/lib/types";
import type { MasterHookId } from "@/lib/master-hooks";

export function FloorVaultInline({
  pool,
  floorVault,
  reserveWei,
  decimals,
  quoteLabel,
  floorPriceHuman,
}: {
  pool: TokenPool;
  floorVault: Address | undefined;
  reserveWei: bigint;
  decimals: number;
  quoteLabel: string;
  floorPriceHuman: number | null;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [redeemAmount, setRedeemAmount] = useState("");

  const redeem = async () => {
    if (!floorVault || !pool.contractAddress || !address) return;
    try {
      const token = pool.contractAddress as Address;
      const amount = parseUnits(redeemAmount, 18);
      const allowance = (await publicClient?.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, floorVault],
      })) as bigint | undefined;
      if ((allowance ?? BigInt(0)) < amount) {
        const approveHash = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [floorVault, amount],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      }
      const hash = await writeContractAsync({
        address: floorVault,
        abi: floorVaultAbi,
        functionName: "redeemFloor",
        args: [token, amount],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      setRedeemAmount("");
      toast.success("Floor redeemed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Redeem failed";
      toast.error("Redeem failed", msg.slice(0, 120));
    }
  };

  const priceLabel =
    floorPriceHuman != null
      ? `${floorPriceHuman.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${quoteLabel}`
      : "—";

  return (
    <div className="token-hooks-vault">
      <div className="token-hooks-vault-meta">
        <span>
          Vault {formatUnits(reserveWei, decimals)} {quoteLabel}
        </span>
        <span>Floor {priceLabel}</span>
      </div>
      <div className="token-hooks-vault-form">
        <input
          value={redeemAmount}
          onChange={(e) => setRedeemAmount(e.target.value)}
          placeholder={`${pool.ticker} amount`}
          className="token-hooks-vault-input"
        />
        <button
          type="button"
          disabled={!floorVault || !redeemAmount || isPending || !address}
          onClick={() => void redeem()}
          className="token-hooks-vault-btn"
        >
          Redeem
        </button>
      </div>
    </div>
  );
}

export function HookInlineAction({
  id,
  pool,
  floorVault,
  floorReserveWei,
  decimals,
  floorPriceHuman,
  quoteLabel,
}: {
  id: MasterHookId;
  pool: TokenPool;
  floorVault: Address | undefined;
  floorReserveWei: bigint;
  decimals: number;
  floorPriceHuman: number | null;
  quoteLabel: string;
}) {
  if (id !== "backed-floor") return null;

  return (
    <FloorVaultInline
      pool={pool}
      floorVault={floorVault}
      reserveWei={floorReserveWei}
      decimals={decimals}
      quoteLabel={quoteLabel}
      floorPriceHuman={floorPriceHuman}
    />
  );
}
