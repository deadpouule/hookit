"use client";

import { Loader2 } from "lucide-react";

import { ConnectButton } from "@/components/wallet/ConnectButton";
import { TARGET_LAUNCH_MCAP_USD } from "@/lib/constants";
import { analyzeCustomHookSource } from "@/lib/custom-hook";
import { accentForTag } from "@/lib/hook-modules";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LaunchPhase = "idle" | "deploying-hook" | "launching" | "done";

type Props = {
  form: LaunchFormState;
  launchFee?: bigint;
  launchFeeEth: number;
  walletReady: boolean;
  factoryConfigured: boolean;
  isPending: boolean;
  phase: LaunchPhase;
  activeTags: string[];
  onLaunch: () => void;
};

export function LaunchSummary({
  form,
  launchFeeEth,
  walletReady,
  factoryConfigured,
  isPending,
  phase,
  activeTags,
  onLaunch,
}: Props) {
  const hookAnalysis =
    form.hookMode === "custom" ? analyzeCustomHookSource(form.customHookSource) : null;

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
        ? "Confirm in wallet"
        : form.hookMode === "custom"
          ? "Deploy & launch"
          : "Launch";

  return (
    <aside className="panel ink-glow gel-surface-active sticky top-20 flex flex-col gap-4 p-5 lg:top-24">
      <div>
        <p className="text-xs text-zinc-600">Overview</p>
        <h2 className="ink-headline mt-1 text-lg">
          {form.name || "New token"}
          {form.ticker && (
            <span className="ml-2 font-mono text-sm font-normal text-zinc-500">${form.ticker}</span>
          )}
        </h2>
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="FDV" value={`$${TARGET_LAUNCH_MCAP_USD.toLocaleString()}`} mono />
        <Row label="Supply" value="1,000,000,000" mono />
        <Row label="Hook" value={form.hookMode === "custom" ? "Custom" : "Master"} />
        <Row label="Quote" value={form.quoteAsset} />
        <Row label="Venue" value="Hookit" />
        <div className="border-t border-white/[0.05] pt-2">
          <Row label="Fee" value={`${launchFeeEth} ETH`} mono />
        </div>
      </dl>

      {activeTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeTags.map((tag) => {
            const accent = accentForTag(tag);
            return (
              <span
                key={tag}
                className="rounded-full border px-2 py-0.5 text-[10px] text-zinc-400"
                style={{
                  borderColor: `${accent.color}40`,
                  color: accent.color,
                  background: `${accent.color}12`,
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {isPending && (
        <ol className="space-y-2 text-xs text-zinc-500">
          {form.hookMode === "custom" && (
            <li className={cn("flex items-center gap-2", phase === "deploying-hook" && "text-ink-lavender")}>
              {phase === "deploying-hook" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="h-1 w-1 rounded-full bg-current" />
              )}
              Deploy hook
            </li>
          )}
          <li className={cn("flex items-center gap-2", phase === "launching" && "text-ink-lavender")}>
            {phase === "launching" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="h-1 w-1 rounded-full bg-current" />
            )}
            Mint token & pool
          </li>
        </ol>
      )}

      {!walletReady ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600">Wallet required on Base Sepolia.</p>
          <ConnectButton className="w-full justify-center !py-2.5" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canLaunch}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {ctaLabel}
        </button>
      )}

      {!factoryConfigured && (
        <p className="text-xs text-zinc-600">
          Set <code className="text-zinc-500">NEXT_PUBLIC_LAUNCH_FACTORY</code> in .env.local
        </p>
      )}
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-600">{label}</dt>
      <dd className={cn("text-zinc-300", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
