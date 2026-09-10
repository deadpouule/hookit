"use client";

import { useState } from "react";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { V4ClaimsClaimAction } from "@/components/token/V4ClaimsClaimAction";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { buybackVaultAbi } from "@/lib/contracts/buyback-vault-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { formatCompactQuoteAmount, formatLiveQuoteWei } from "@/lib/format";
import { formatVestRemaining } from "@/lib/module-live-stats";
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
    // Leave 1 wei when holder-airdrop tracking is on so a full exit cannot
    // hit the pre-fix `_removeHolder` OOB on already-deployed vaults.
    const spend = pool.hooks.holderAirdrop && bal > BigInt(1) ? bal - BigInt(1) : bal;
    setRedeemAmount(formatUnits(spend, 18));
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

  const ticker = quoteLabel;
  const priceLabel =
    floorPriceHuman != null
      ? `${formatCompactQuoteAmount(floorPriceHuman)} ${ticker}`
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
          Vault {formatCompactQuoteAmount(Number(formatUnits(reserveWei, decimals)))} {ticker}
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
  vestSecondsLeft,
  quoteLabel,
  decimals,
  embedded = false,
  onClaimed,
}: {
  pool: TokenPool;
  buybackVault: Address | undefined;
  claimableWei: bigint;
  vestSecondsLeft?: number | null;
  quoteLabel: string;
  decimals: number;
  embedded?: boolean;
  onClaimed?: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const token = pool.contractAddress as Address | undefined;
  const isCreator =
    !!address && !!pool.creator && address.toLowerCase() === pool.creator.toLowerCase();

  const ticker = quoteLabel;
  const claimLabel = `${formatLiveQuoteWei(claimableWei, decimals)} ${ticker}`;
  const remainLabel =
    vestSecondsLeft != null && vestSecondsLeft > 0 ? formatVestRemaining(vestSecondsLeft) : null;
  const canClaim =
    !!buybackVault && !!token && !!address && isCreator && claimableWei > BigInt(0) && !isPending;

  const claim = async () => {
    if (!canClaim || !buybackVault || !token) return;
    try {
      const hash = await writeContractAsync({
        address: buybackVault,
        abi: buybackVaultAbi,
        functionName: "claim",
        args: [token],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      onClaimed?.();
      toast.success("Vested fees claimed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error("Claim failed", msg.slice(0, 120));
    }
  };

  const button = (
    <button
      type="button"
      disabled={!canClaim}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void claim();
      }}
      className={cn(
        "token-hooks-vault-btn token-hooks-claim-btn",
        !canClaim && "token-hooks-vault-btn--idle",
      )}
    >
      <span className="token-hooks-claim-label">{isPending ? "Claiming…" : "Claim"}</span>
      {remainLabel ? <span className="token-hooks-claim-sub">{remainLabel}</span> : null}
    </button>
  );

  if (embedded) {
    return (
      <div className="token-hooks-chip-actions token-hooks-chip-actions--buyback">
        {button}
      </div>
    );
  }

  return (
    <div className="token-hooks-vault">
      <div className="token-hooks-vault-meta">
        <span>Claimable</span>
        <span className="token-hooks-chip-stat--live">{claimLabel}</span>
      </div>
      {button}
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

  const ticker = quoteLabel;
  const potLabel = `${formatCompactQuoteAmount(Number(formatUnits(reserveWei, decimals)))} ${ticker}`;
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
  buybackVestSecondsLeft,
  decimals,
  floorPriceHuman,
  quoteLabel,
  embedded = false,
  theme,
  onBuybackClaimed,
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
  buybackVestSecondsLeft?: number | null;
  decimals: number;
  floorPriceHuman: number | null;
  quoteLabel: string;
  embedded?: boolean;
  theme?: HookTheme;
  onBuybackClaimed?: () => void;
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
        vestSecondsLeft={buybackVestSecondsLeft}
        quoteLabel={quoteLabel}
        decimals={decimals}
        embedded={embedded}
        onClaimed={onBuybackClaimed}
      />
    );
  }

  return null;
}
