"use client";

import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { fetchIndexerHolders } from "@/lib/indexer-client";
import { isIndexerConfigured } from "@/lib/live-data";
import { toast } from "@/lib/toast";
import type { TokenPool } from "@/lib/types";
import type { HookTheme, MasterHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

export function FloorVaultInline({
  pool,
  floorVault,
  reserveWei,
  decimals,
  quoteLabel,
  floorPriceHuman,
  embedded = false,
  theme = "gold",
}: {
  pool: TokenPool;
  floorVault: Address | undefined;
  reserveWei: bigint;
  decimals: number;
  quoteLabel: string;
  floorPriceHuman: number | null;
  embedded?: boolean;
  theme?: HookTheme;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [redeemAmount, setRedeemAmount] = useState("");
  const token = pool.contractAddress as Address | undefined;

  const { data: tokenBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!token && !!address },
  });

  const applyMax = () => {
    const bal = (tokenBalance as bigint | undefined) ?? BigInt(0);
    if (bal <= BigInt(0)) return;
    setRedeemAmount(formatUnits(bal, 18));
  };

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

  if (embedded) {
    return (
      <div className="token-hooks-chip-actions token-hooks-chip-actions--floor">
        <div className={cn("token-hooks-vault-field", `token-hooks-vault-field--${theme}`)}>
          <input
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(e.target.value)}
            placeholder={`${pool.ticker} amount`}
            className="token-hooks-vault-input"
          />
          <button
            type="button"
            disabled={!address || !tokenBalance || (tokenBalance as bigint) <= BigInt(0)}
            onClick={applyMax}
            className="token-hooks-vault-max"
          >
            MAX
          </button>
        </div>
        <button
          type="button"
          disabled={!floorVault || !redeemAmount || isPending || !address}
          onClick={() => void redeem()}
          className="token-hooks-vault-btn"
        >
          Redeem
        </button>
      </div>
    );
  }

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

function formatAirdropWait(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function HolderAirdropInline({
  pool,
  airdropVault,
  reserveWei,
  secondsLeft,
  decimals,
  quoteLabel,
  embedded = false,
}: {
  pool: TokenPool;
  airdropVault: Address | undefined;
  reserveWei: bigint;
  secondsLeft: number | null;
  decimals: number;
  quoteLabel: string;
  embedded?: boolean;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const token = pool.contractAddress as Address | undefined;

  const { data: holderBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!token && !!address },
  });

  const potLabel = `${formatUnits(reserveWei, decimals)} ${quoteLabel}`;
  const ready = reserveWei > BigInt(0) && secondsLeft != null && secondsLeft <= 0;
  const holdsToken = ((holderBalance as bigint | undefined) ?? BigInt(0)) > BigInt(0);
  const indexerReady = isIndexerConfigured();

  const claimDrop = async () => {
    if (!airdropVault || !token) return;
    try {
      const { holders } = await fetchIndexerHolders(token, 5000);
      const addresses = holders
        .filter((h) => BigInt(h.balance) > BigInt(0))
        .map((h) => h.address as Address);
      if (addresses.length === 0) {
        toast.error("No holders indexed yet");
        return;
      }
      const hash = await writeContractAsync({
        address: airdropVault,
        abi: holderAirdropVaultAbi,
        functionName: "airdrop",
        args: [token, addresses],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Holder drop sent", "Quote was split pro-rata to all holders.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(
        "Claim failed",
        msg.includes("IncompleteHolderSet")
          ? "Holder list incomplete — try again after more swaps are indexed."
          : msg.slice(0, 120),
      );
    }
  };

  let disabledReason: string | null = null;
  if (!address) disabledReason = "Connect wallet";
  else if (!indexerReady) disabledReason = "Indexer required";
  else if (reserveWei === BigInt(0)) disabledReason = "Pot empty";
  else if (!ready) disabledReason = `Wait ${formatAirdropWait(secondsLeft)}`;
  else if (!holdsToken) disabledReason = "Hold tokens to claim";

  if (embedded) {
    return (
      <div className="token-hooks-chip-actions token-hooks-chip-actions--stack">
        <button
          type="button"
          disabled={!airdropVault || isPending || !!disabledReason}
          onClick={() => void claimDrop()}
          className="token-hooks-vault-btn w-full"
          title={disabledReason ?? undefined}
        >
          {isPending ? "Claiming…" : disabledReason ?? "Claim drop"}
        </button>
      </div>
    );
  }

  return (
    <div className="token-hooks-vault token-hooks-vault--passive">
      <div className="token-hooks-vault-meta">
        <span>Pot {potLabel}</span>
        <span className={ready ? "token-hooks-vault-ready" : undefined}>
          {formatAirdropWait(secondsLeft)}
        </span>
      </div>
      <p className="token-hooks-vault-copy">
        Quote is split pro-rata to all holders — no manual amount. Claim pushes the pot when the
        window is open.
      </p>
      <button
        type="button"
        disabled={!airdropVault || isPending || !!disabledReason}
        onClick={() => void claimDrop()}
        className="token-hooks-vault-btn w-full"
        title={disabledReason ?? undefined}
      >
        {isPending ? "Claiming…" : disabledReason ?? "Claim drop"}
      </button>
    </div>
  );
}

export function HookInlineAction({
  id,
  pool,
  floorVault,
  floorReserveWei,
  airdropVault,
  airdropReserveWei,
  airdropSecondsLeft,
  decimals,
  floorPriceHuman,
  quoteLabel,
  embedded = false,
  theme,
}: {
  id: MasterHookId;
  pool: TokenPool;
  floorVault: Address | undefined;
  floorReserveWei: bigint;
  airdropVault?: Address | undefined;
  airdropReserveWei?: bigint;
  airdropSecondsLeft?: number | null;
  decimals: number;
  floorPriceHuman: number | null;
  quoteLabel: string;
  embedded?: boolean;
  theme?: HookTheme;
}) {
  if (id === "backed-floor") {
    return (
      <FloorVaultInline
        pool={pool}
        floorVault={floorVault}
        reserveWei={floorReserveWei}
        decimals={decimals}
        quoteLabel={quoteLabel}
        floorPriceHuman={floorPriceHuman}
        embedded={embedded}
        theme={theme ?? "gold"}
      />
    );
  }

  if (id === "holder-airdrop") {
    return (
      <HolderAirdropInline
        pool={pool}
        airdropVault={airdropVault}
        reserveWei={airdropReserveWei ?? BigInt(0)}
        secondsLeft={airdropSecondsLeft ?? null}
        decimals={decimals}
        quoteLabel={quoteLabel}
        embedded={embedded}
      />
    );
  }

  return null;
}
