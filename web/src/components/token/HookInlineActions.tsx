"use client";

import { useState } from "react";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { V4ClaimsClaimAction } from "@/components/token/V4ClaimsClaimAction";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { buybackVaultAbi } from "@/lib/contracts/buyback-vault-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
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

export function BuybackVestingInline({
  pool,
  buybackVault,
  claimableWei,
  quoteLabel,
  decimals,
  embedded = false,
}: {
  pool: TokenPool;
  buybackVault: Address | undefined;
  claimableWei: bigint;
  quoteLabel: string;
  decimals: number;
  embedded?: boolean;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const token = pool.contractAddress as Address | undefined;
  const isCreator =
    !!address && !!pool.creator && address.toLowerCase() === pool.creator.toLowerCase();

  const claimLabel = `${formatUnits(claimableWei, decimals)} ${quoteLabel}`;

  const claim = async () => {
    if (!buybackVault || !token || !address) return;
    try {
      const hash = await writeContractAsync({
        address: buybackVault,
        abi: buybackVaultAbi,
        functionName: "claim",
        args: [token],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success("Vested fees claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };

  if (!isCreator) {
    return embedded ? null : (
      <p className="token-hooks-vault-copy text-[11px] text-zinc-500">
        Creator fees vest linearly — only the launcher can claim.
      </p>
    );
  }

  if (embedded) {
    if (claimableWei <= BigInt(0)) return null;
    return (
      <div className="token-hooks-chip-actions token-hooks-chip-actions--buyback">
        <span className="token-hooks-vault-copy text-[11px] text-zinc-400">{claimLabel} vested</span>
        <button
          type="button"
          disabled={!buybackVault || claimableWei <= BigInt(0) || isPending || !address}
          onClick={() => void claim()}
          className="token-hooks-vault-btn"
        >
          Claim
        </button>
      </div>
    );
  }

  return (
    <div className="token-hooks-vault">
      <div className="token-hooks-vault-meta">
        <span>Claimable</span>
        <span>{claimLabel}</span>
      </div>
      <button
        type="button"
        disabled={!buybackVault || claimableWei <= BigInt(0) || isPending || !address}
        onClick={() => void claim()}
        className="token-hooks-vault-btn"
      >
        Claim vested fees
      </button>
    </div>
  );
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
  const token = pool.contractAddress as Address | undefined;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;

  const { data: holderCount } = useReadContract({
    address: airdropVault,
    abi: holderAirdropVaultAbi,
    functionName: "holderCount",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token, refetchInterval: 15_000 },
  });

  const potLabel = `${formatUnits(reserveWei, decimals)} ${quoteLabel}`;
  const ready = reserveWei > BigInt(0) && secondsLeft != null && secondsLeft <= 0;
  const status = ready
    ? "Next swap pays holders automatically"
    : `Payout opens in ${formatAirdropWait(secondsLeft)}`;

  if (embedded) {
    return (
      <div className="space-y-2">
        <p className="token-hooks-vault-copy text-[11px] leading-relaxed text-zinc-500">{status}</p>
        <V4ClaimsClaimAction
          quote={quote}
          decimals={decimals}
          quoteLabel={quoteLabel}
          embedded
        />
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
        {Number(holderCount ?? 0).toLocaleString()} on-chain holders tracked. {status} — no keeper or
        indexer required.
      </p>
      <V4ClaimsClaimAction quote={quote} decimals={decimals} quoteLabel={quoteLabel} />
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
  buybackVault,
  buybackClaimableWei,
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
  buybackVault?: Address | undefined;
  buybackClaimableWei?: bigint;
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

  if (id === "buyback-vesting") {
    return (
      <BuybackVestingInline
        pool={pool}
        buybackVault={buybackVault}
        claimableWei={buybackClaimableWei ?? BigInt(0)}
        quoteLabel={quoteLabel}
        decimals={decimals}
        embedded={embedded}
      />
    );
  }

  return null;
}
