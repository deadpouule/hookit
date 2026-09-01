"use client";

import { Loader2, Rocket, ImagePlus } from "lucide-react";

import { LaunchSummaryModuleRow } from "@/components/launch/LaunchSummaryModuleRow";
import { PairingMark } from "@/components/launch/PairingMark";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { BASE_FEE_BPS, TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { formatDynamicFeeRange, totalFeeBps } from "@/lib/fee-range";
import { feeRouteIsComplete } from "@/lib/hook-fee-route";
import { getNetworkLabel } from "@/lib/chains";
import { formatPairingTicker } from "@/lib/pairing-tokens";
import { analyzeCustomHookSource } from "@/lib/custom-hook";
import { hasDevBuyConfigured, resolveDevBuyQuoteWei } from "@/lib/dev-buy-launch";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import type { HookId } from "@/lib/hook-marks";
import { formatBps } from "@/lib/format";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { zeroAddress } from "viem";

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

type LaunchSummaryCtaProps = {
  form: LaunchFormState;
  variant?: "classic" | "custom";
  launchFeeEth: number;
  walletReady: boolean;
  factoryConfigured: boolean;
  isPending: boolean;
  phase: LaunchPhase;
  onLaunch: () => void;
  className?: string;
};

export function LaunchSummaryCta({
  form,
  variant = "custom",
  walletReady,
  factoryConfigured,
  isPending,
  phase,
  onLaunch,
  className,
}: LaunchSummaryCtaProps) {
  const hookAnalysis =
    form.hookMode === "custom" ? analyzeCustomHookSource(form.customHookSource) : null;

  const canLaunch =
    !!form.name &&
    !!form.ticker &&
    walletReady &&
    factoryConfigured &&
    !isPending &&
    (form.hookMode !== "custom" || (hookAnalysis?.valid ?? false)) &&
    (form.hookMode !== "master" || feeRouteIsComplete(form.modules));

  const ctaLabel = !walletReady
    ? "Connect wallet"
    : form.hookMode === "custom" && phase === "deploying-hook"
      ? "Deploying hook…"
      : isPending
        ? "Confirm in wallet…"
        : form.hookMode === "custom"
          ? "Deploy hook & launch"
          : "Launch token";

  if (!walletReady) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-xs text-zinc-500">Connect a wallet on {getNetworkLabel()} to launch.</p>
        <ConnectButton className="w-full justify-center py-2.5" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onLaunch}
      disabled={!canLaunch}
      className={cn(
        "launch-coin-nav justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Rocket className="h-4 w-4" />
      )}
      {ctaLabel}
    </button>
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
  showLaunchCta?: boolean;
  sticky?: boolean;
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
  showLaunchCta = true,
  sticky = true,
}: Props) {
  const summaryHooks = activeHooks.filter((id) => id !== "quoteFee");
  const showActiveModules = summaryHooks.length > 0;

  const primaryQuoteId = form.markets[0]?.id ?? form.quoteAsset;
  const quoteAddr =
    primaryQuoteId === "eth"
      ? zeroAddress
      : primaryQuoteId === "usdg"
        ? STABLE_QUOTE_ADDRESS
        : zeroAddress;
  const devBuyConfigured = hasDevBuyConfigured(form);
  const devBuyQuoteWei = devBuyConfigured
    ? resolveDevBuyQuoteWei(form, {
        rail: variant === "classic" ? "classic" : "master",
        quote: quoteAddr,
      })
    : null;
  const devBuyPayLabel = primaryQuoteId === "eth" ? "ETH" : formatPairingTicker(primaryQuoteId);

  return (
    <aside
      className={cn(
        "panel flex flex-col gap-4 p-5",
        sticky && "sticky top-20 lg:top-24",
      )}
    >
      <div>
        <h2 className="text-lg font-medium text-white">
          {form.name || "Untitled token"}
          {form.ticker && (
            <span className="ml-2 font-mono text-sm text-zinc-500">${form.ticker}</span>
          )}
        </h2>
        <div
          className={cn(
            "launch-summary-logo mt-3 flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/30",
            form.imagePreview && "border-white/20 p-0",
          )}
        >
          {form.imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.imagePreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 px-2 text-center">
              <ImagePlus className="h-5 w-5 text-zinc-600" aria-hidden />
              <span className="text-[10px] leading-tight text-zinc-500">Logo</span>
            </div>
          )}
        </div>
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
              {form.modules.dynamicFees
                ? formatDynamicFeeRange(form.modules, form.hookTaxBps)
                : formatBps(totalFeeBps(form.modules, form.hookTaxBps))}
            </dd>
          </div>
        )}
        {devBuyConfigured && devBuyQuoteWei && devBuyQuoteWei > 0n && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Dev buy</dt>
            <dd className="font-mono text-right text-zinc-200">
              {form.devBuyMode === "supply"
                ? `${form.devBuySupplyPct.toFixed(2)}% supply`
                : `${form.devBuyEth} ${devBuyPayLabel}`}
            </dd>
          </div>
        )}
      </dl>

      {showActiveModules && (
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-3 py-3">
          <span className="token-type-badge token-type-badge--master token-hooks-count-badge mb-2">
            <MasterHookGlyph className="token-type-badge-glyph" />
            {form.hookMode === "custom"
              ? `${summaryHooks.length} hook${summaryHooks.length === 1 ? "" : "s"}`
              : `${summaryHooks.length} active module${summaryHooks.length === 1 ? "" : "s"}`}
          </span>
          <ul className="space-y-2 text-xs">
            {summaryHooks.map((id) => (
              <LaunchSummaryModuleRow
                key={id}
                id={id}
                modules={form.modules}
                hookTaxBps={form.hookTaxBps}
              />
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
            Create pool & token{devBuyConfigured ? " + dev buy" : ""}
          </li>
        </ol>
      )}

      {showLaunchCta ? (
        <>
          {!walletReady ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">Connect a wallet on {getNetworkLabel()} to launch.</p>
              <ConnectButton className="w-full justify-center py-2.5" />
            </div>
          ) : (
            <LaunchSummaryCta
              form={form}
              variant={variant}
              launchFeeEth={launchFeeEth}
              walletReady={walletReady}
              factoryConfigured={factoryConfigured}
              isPending={isPending}
              phase={phase}
              onLaunch={onLaunch}
              className="w-full"
            />
          )}
        </>
      ) : null}

      {!factoryConfigured && (
        <p className="text-xs text-amber-200/80">
          Set <code className="font-mono">NEXT_PUBLIC_LAUNCH_FACTORY</code> in{" "}
          <code className="font-mono">.env.local</code>
        </p>
      )}
    </aside>
  );
}
