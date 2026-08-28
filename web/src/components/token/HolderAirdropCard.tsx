"use client";

import { formatUnits, zeroAddress, type Address } from "viem";
import { useReadContract } from "wagmi";

import { HookChip } from "@/components/hooks/HookMark";
import { getLaunchFactoryAddress, STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { poolQuoteLabel } from "@/lib/payment-assets";
import type { TokenPool } from "@/lib/types";

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

/** Status card for Master launches with the holder-airdrop module. */
export function HolderAirdropCard({ pool }: { pool: TokenPool }) {
  const factory = getLaunchFactoryAddress();
  const isClassic = pool.rail === "classic";
  const enabled = !!pool.hooks.holderAirdrop && !isClassic && !pool.hooks.customHook;
  const token = pool.contractAddress as Address | undefined;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory && enabled },
  });

  const { data: vault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "holderAirdropVault",
    query: { enabled: !!masterHook && enabled },
  });

  const { data: reserveWei } = useReadContract({
    address: vault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "reserve",
    args: token ? [token] : undefined,
    query: { enabled: !!vault && !!token && enabled, refetchInterval: 12_000 },
  });

  const { data: secondsLeft } = useReadContract({
    address: vault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "secondsUntilAirdrop",
    args: token ? [token] : undefined,
    query: { enabled: !!vault && !!token && enabled, refetchInterval: 5_000 },
  });

  if (!enabled) return null;

  const pending =
    reserveWei !== undefined ? Number(formatUnits(reserveWei, decimals)) : null;
  const wait = secondsLeft !== undefined ? Number(secondsLeft) : null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
          Holder airdrop
        </p>
        <HookChip id="holderAirdrop" />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] text-zinc-600">Pending pot</dt>
          <dd className="mt-0.5 font-mono text-sm text-zinc-100">
            {pending === null
              ? "—"
              : `${pending.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${quoteLabel}`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-zinc-600">Next window</dt>
          <dd className="mt-0.5 font-mono text-sm text-zinc-100">
            {wait === null ? "—" : formatCountdown(wait)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        Quote fees accrue here. Once the 15m window is open, the next swap on this token can push the
        pot pro-rata to holders (router supplies the holder set) — no separate keeper bot.
      </p>
    </div>
  );
}
