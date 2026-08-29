"use client";

import { Loader2, Rocket } from "lucide-react";

import { LaunchHookBadge } from "@/components/launch/LaunchHookBadge";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { getNetworkLabel } from "@/lib/chains";
import { formatPairingTicker } from "@/lib/pairing-tokens";
import { analyzeCustomHookSource } from "@/lib/custom-hook";
import type { HookId } from "@/lib/hook-marks";
import {
  hookTaxSummary,
  listEnabledModuleSummaries,
  totalFeeSummary,
} from "@/lib/launch-module-summary";
import { formatBps } from "@/lib/format";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LaunchPhase = "idle" | "deploying-hook" | "launching" | "done";

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

  const moduleLines =
    form.hookMode === "master"
      ? listEnabledModuleSummaries(form.modules, { includeCreatorShare: true })
      : [];

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
          <dd className="font-mono text-zinc-200 text-right">
            {form.markets.length > 1
              ? form.markets
                  .map((m) => `${formatPairingTicker(m.id)} ${(m.bps / 100).toFixed(0)}%`)
                  .join(" · ")
              : formatPairingTicker(form.quoteAsset)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Hook</dt>
          <dd className="text-zinc-200">
            {variant === "classic"
              ? "Classic"
              : form.hookMode === "custom"
                ? "Custom (your code)"
                : "Master"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Network</dt>
          <dd className="text-zinc-200">{getNetworkLabel()}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Contract</dt>
          <dd className="font-mono text-xs text-zinc-400">···8 (Hookit)</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/[0.06] pt-2.5">
          <dt className="text-zinc-500">Launch fee</dt>
          <dd className="font-mono text-zinc-200">{launchFeeEth} ETH</dd>
        </div>
        {form.hookMode === "master" && variant !== "classic" && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Hook tax</dt>
              <dd className="font-mono text-right text-zinc-200">
                {formatBps(form.hookTaxBps)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Total swap fee</dt>
              <dd className="text-right text-xs text-zinc-400">{totalFeeSummary(form.hookTaxBps)}</dd>
            </div>
          </>
        )}
      </dl>

      {moduleLines.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-3">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Active modules
          </p>
          <ul className="space-y-2 text-xs">
            {moduleLines.map((line) => (
              <li key={line.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                <span className="shrink-0 text-zinc-300">{line.title}</span>
                <span className="font-mono text-zinc-500 sm:text-right">{line.detail}</span>
              </li>
            ))}
          </ul>
          {form.hookTaxBps > 0 && (
            <p className="mt-2 border-t border-white/[0.05] pt-2 font-mono text-[11px] text-zinc-600">
              {hookTaxSummary(form.hookTaxBps)}
            </p>
          )}
        </div>
      )}

      {activeHooks.length > 0 && (
        <div className="launch-summary-hooks">
          {activeHooks.map((id) => (
            <LaunchHookBadge key={id} id={id} />
          ))}
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
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
