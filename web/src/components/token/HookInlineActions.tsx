"use client";

import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import { toast } from "@/lib/toast";
import type { LaunchModules, TokenPool } from "@/lib/types";
import type { MasterHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

type LiveBits = {
  floorPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  burnedPct: number | null;
  quoteLabel: string;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

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
        <span>P_floor {priceLabel}</span>
      </div>
      <p className="token-hooks-vault-copy">
        Redeem {pool.ticker} for quote at the ratchet floor price.
      </p>
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

export function AirdropVaultInline({
  live,
}: {
  live: LiveBits;
}) {
  const ready = live.airdropSecondsLeft != null && live.airdropSecondsLeft <= 0;
  const pot =
    live.airdropPendingHuman != null
      ? `${live.airdropPendingHuman.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${live.quoteLabel}`
      : "—";
  const window =
    live.airdropSecondsLeft == null ? "—" : formatCountdown(live.airdropSecondsLeft);

  return (
    <div className="token-hooks-vault">
      <div className="token-hooks-vault-meta">
        <span>Pending pot {pot}</span>
        <span className={cn(ready && "token-hooks-vault-ready")}>Next {window}</span>
      </div>
      <p className="token-hooks-vault-copy">
        {ready
          ? "Window open — the next swap on this token can push the pot pro-rata to holders."
          : "Fees accrue in the vault. When Ready, a swap distributes the pot — no separate claim."}
      </p>
    </div>
  );
}

export function AutoBurnInline({ burnedPct, feePct }: { burnedPct: number | null; feePct: number }) {
  const pct = burnedPct ?? 0;
  return (
    <div className="token-hooks-vault">
      <div className="token-hooks-vault-meta">
        <span>{feePct}% of hook fees → burn</span>
        <span>{burnedPct == null ? "—" : `${burnedPct.toFixed(2)}% supply burned`}</span>
      </div>
      <div className="token-hooks-burn-track" aria-hidden>
        <span className="token-hooks-burn-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="token-hooks-vault-copy">Burns run automatically on every swap — no manual action.</p>
    </div>
  );
}

export function PassiveHookInline({ copy }: { copy: string }) {
  return (
    <div className="token-hooks-vault token-hooks-vault--passive">
      <p className="token-hooks-vault-copy">{copy}</p>
    </div>
  );
}

export function HookInlineAction({
  id,
  pool,
  modules,
  live,
  floorVault,
  floorReserveWei,
  decimals,
}: {
  id: MasterHookId;
  pool: TokenPool;
  modules: LaunchModules;
  live: LiveBits;
  floorVault: Address | undefined;
  floorReserveWei: bigint;
  decimals: number;
}) {
  switch (id) {
    case "backed-floor":
      return (
        <FloorVaultInline
          pool={pool}
          floorVault={floorVault}
          reserveWei={floorReserveWei}
          decimals={decimals}
          quoteLabel={live.quoteLabel}
          floorPriceHuman={live.floorPriceHuman}
        />
      );
    case "holder-airdrop":
      return <AirdropVaultInline live={live} />;
    case "auto-burn":
      return <AutoBurnInline burnedPct={live.burnedPct} feePct={modules.autoBurnPct} />;
    case "anti-snipe":
      return (
        <PassiveHookInline copy="Opening buys pay a decaying tax that fades over the launch window — automatic, no claim." />
      );
    case "anti-mev":
      return (
        <PassiveHookInline copy="Same-block opposing swaps are blocked on-chain — protection runs on every trade." />
      );
    case "max-tx":
      return (
        <PassiveHookInline
          copy={`Each swap is capped at ${(modules.maxTxBps / 100).toFixed(1)}% of supply — oversized trades revert.`}
        />
      );
    case "max-wallet":
      return (
        <PassiveHookInline
          copy={`Wallets cannot hold more than ${(modules.maxWalletBps / 100).toFixed(1)}% of supply after buys.`}
        />
      );
    case "dynamic-fees":
      return (
        <PassiveHookInline copy="LP fee ramps with flow via Uniswap v4’s dynamic fee flag — adjusted on swap." />
      );
    case "buyback-vesting":
      return (
        <PassiveHookInline copy="Creator proceeds vest linearly in BuybackVault — claim after unlock from the vesting schedule." />
      );
    case "lp-donate":
      return (
        <PassiveHookInline
          copy={`${modules.lpDonatePct}% of hook fees are donated to in-range LPs automatically on swaps.`}
        />
      );
    case "creator-share-to-hook":
      return (
        <PassiveHookInline copy="Your 70% of the base 1% joins the hook pot instead of escrow — fuels the modules above." />
      );
    default:
      return null;
  }
}
