"use client";

import { Loader2, Rocket } from "lucide-react";

import { LaunchSummaryModuleRow } from "@/components/launch/LaunchSummaryModuleRow";
import { PairingMark } from "@/components/launch/PairingMark";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { BASE_FEE_BPS, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { getNetworkLabel } from "@/lib/chains";
import { formatPairingTicker } from "@/lib/pairing-tokens";
import { analyzeCustomHookSource } from "@/lib/custom-hook";
import type { HookId } from "@/lib/hook-marks";
import { formatBps } from "@/lib/format";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LaunchPhase = "idle" | "deploying-hook" | "launching" | "done";

function SummaryPairValue({ form }: { form: LaunchFormState }) {
  if (form.markets.length > 1) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1.5">
        {form.markets.map((market) => (
          <span key={market.id} className="inline-flex items-center gap-1.5">
            <PairingMark id={market.id} size="sm" />
            <span className="font-mono text-zinc-200">
              {formatPairingTicker(market.id)} {(market.bps / 100).toFixed(0)}%
            </span>
          </span>
        ))}
      </div>
    );
  }

  const pairId = form.markets[0]?.id ?? form.quoteAsset;

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <PairingMark id={pairId} size="sm" />
      <span className="font-mono text-zinc-200">{formatPairingTicker(pairId)}</span>
    </span>
  );
}

type Props = {
  form: LaunchFormState;
  variant?: "classic" | "custom";
  launchFee?: bigint;
  launchFeeEth: number;
  walletReady: boolean;
  factoryConfigured: boolean;
  isPending: boolean;
  phase: LaunchPhase;
  activeHooks: HookId[];
  onLaunch: () => void;
};

export function LaunchSummary({
  form,
  variant = "custom",
  launchFeeEth,
  walletReady,
  factoryConfigured,
  isPending,
  phase,
  activeHooks,
  onLaunch,
}: Props) {
  const hookAnalysis =
    form.hookMode === "custom" ? analyzeCustomHookSource(form.customHookSource) : null;

  const summaryHooks = activeHooks.filter((id) => id !== "quoteFee");
  const showActiveModules = summaryHooks.length > 0;

  const canLaunch =
    !!form.name &&
    !!form.ticker &&
    walletReady &&
    factoryConfigured &&
    !isPending &&
    (form.hookMode !== "custom" || (hookAnalysis?.valid ?? false));

  const ctaLabel = !walletReady
    ? "Connect wallet"
    : form.hookMode === "custom" && phase === "deploying-hook"
      ? "Deploying hook…"
      : isPending
        ? "Confirm in wallet…"
        : form.hookMode === "custom"
          ? "Deploy hook & launch"
          : "Launch token";

  return (
    <aside className="panel sticky top-20 flex flex-col gap-4 p-5 lg:top-24">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Summary</p>
        <h2 className="mt-1 text-lg font-medium text-white">
          {form.name || "Untitled token"}
          {form.ticker && (
            <span className="ml-2 font-mono text-sm text-zinc-500">${form.ticker}</span>
          )}
        </h2>
      </div>

      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Launch FDV</dt>
          <dd className="font-mono text-zinc-200">${TARGET_LAUNCH_MCAP_USD.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Supply</dt>
          <dd className="font-mono text-zinc-200">1B</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">{form.markets.length > 1 ? "Pairs" : "Pair"}</dt>
          <dd className="text-right">
            <SummaryPairValue form={form} />
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/[0.06] pt-2.5">
          <dt className="text-zinc-500">Launch fee</dt>
          <dd className="font-mono text-zinc-200">{launchFeeEth} ETH</dd>
        </div>
        {form.hookMode === "master" && variant !== "classic" && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Fees</dt>
            <dd className="font-mono text-right text-zinc-200">
              {formatBps(BASE_FEE_BPS + form.hookTaxBps)}
            </dd>
          </div>
        )}
      </dl>

      {showActiveModules && (
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-3">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            {form.hookMode === "custom" ? "Hook" : "Active modules"}
          </p>
          <ul className="space-y-2 text-xs">
            {summaryHooks.map((id) => (
              <LaunchSummaryModuleRow key={id} id={id} modules={form.modules} />
            ))}
          </ul>
        </div>
      )}

      {isPending && (
        <ol className="space-y-2 rounded-xl border border-white/[0.06] bg-black/40 px-3 py-3 text-xs">
          {form.hookMode === "custom" && (
            <li
              className={cn(
                "flex items-center gap-2",
                phase === "deploying-hook" ? "text-base-blue" : phase === "idle" ? "text-zinc-600" : "text-emerald-400",
              )}
            >
              {phase === "deploying-hook" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
              Mine & deploy hook
            </li>
          )}
          <li
            className={cn(
              "flex items-center gap-2",
              phase === "launching" ? "text-base-blue" : phase === "done" ? "text-emerald-400" : "text-zinc-600",
            )}
          >
            {phase === "launching" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
            Create pool & token
          </li>
        </ol>
      )}

      {!walletReady ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Connect a wallet on {getNetworkLabel()} to launch.</p>
          <ConnectButton className="w-full justify-center py-2.5" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canLaunch}
          className="launch-coin-nav w-full justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {ctaLabel}
        </button>
      )}

      {!factoryConfigured && (
        <p className="text-xs text-amber-200/80">
          Set <code className="font-mono">NEXT_PUBLIC_LAUNCH_FACTORY</code> in{" "}
          <code className="font-mono">.env.local</code>
        </p>
      )}
    </aside>
  );
}
