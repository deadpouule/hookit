"use client";

import { AccentSlider } from "@/components/launch/AccentSlider";
import { HookLogo } from "@/components/home/market/HookLogo";
import { BASE_FEE_BPS, CREATOR_SHARE_BPS } from "@/lib/constants";
import {
  formatDynamicFeeRange,
  resolveEffectiveHookTaxBps,
  totalFeeBps,
} from "@/lib/fee-range";
import {
  feeRouteSliderMax,
  feeRouteSwapBps,
  feeRouteTotalPct,
  getFeeRouteValue,
  hookPotBps,
  listEnabledFeeRoutes,
  setFeeRouteShare,
  type FeeRouteKey,
} from "@/lib/hook-fee-route";
import { hookAccentColor, MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_HOOK: Record<FeeRouteKey, MasterHookId> = {
  floorAllocation: "backed-floor",
  autoBurnPct: "auto-burn",
  deepenLpsPct: "deepen-lps",
  holderAirdropPct: "holder-airdrop",
};

function swapPctLabel(bps: number): string {
  const pct = bps / 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(2)}%`;
}

function hookForRoute(key: FeeRouteKey) {
  return MASTER_HOOKS.find((hook) => hook.id === ROUTE_HOOK[key]);
}

function feeChoiceRecall(modules: LaunchModules, hookTaxBps: number): string {
  const taxBps = resolveEffectiveHookTaxBps(modules, hookTaxBps);
  if (modules.dynamicFees) {
    return `You chose dynamic fees from ${formatDynamicFeeRange(modules, hookTaxBps)}.`;
  }
  if (taxBps > 0) {
    return `You chose a fixed hook tax of ${swapPctLabel(taxBps)}. Traders also pay the ${swapPctLabel(BASE_FEE_BPS)} base fee.`;
  }
  return `You chose no extra hook tax. Traders pay the ${swapPctLabel(BASE_FEE_BPS)} base fee.`;
}

export function FeeSplitStep({
  modules,
  hookTaxBps,
  onUpdate,
}: {
  modules: LaunchModules;
  hookTaxBps: number;
  onUpdate: (patch: Partial<LaunchModules>) => void;
}) {
  const routes = listEnabledFeeRoutes(modules);
  const taxBps = resolveEffectiveHookTaxBps(modules, hookTaxBps);
  const potBps = hookPotBps(modules, hookTaxBps);
  const totalBps = totalFeeBps(modules, hookTaxBps);
  const shareTotal = feeRouteTotalPct(modules);
  const solo = routes.length === 1;
  const creatorCutBps = Math.round((BASE_FEE_BPS * CREATOR_SHARE_BPS) / 10_000);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="pick-heading">Split hook fees</p>

      <p className="pick-config-hint" style={{ marginTop: 0 }}>
        {feeChoiceRecall(modules, hookTaxBps)}
      </p>

      {potBps > 0 ? (
        <p className="pick-config-hint" style={{ marginTop: 0 }}>
          Hook pot to split: {swapPctLabel(potBps)} of each swap
          {modules.creatorShareToHook
            ? ` (${swapPctLabel(taxBps)} hook tax + ${swapPctLabel(creatorCutBps)} creator → hook)`
            : modules.dynamicFees
              ? ` at the top of the ${swapPctLabel(totalBps)} range`
              : null}
          . Move a slider and the others rebalance so it stays 100%.
        </p>
      ) : routes.length > 0 ? (
        <p className="pick-config-hint pick-config-hint--warn" style={{ marginTop: 0 }}>
          These modules need a funded pot. Go back and add a hook tax, or turn on Creator → Hook.
        </p>
      ) : (
        <p className="pick-config-hint" style={{ marginTop: 0 }}>
          No burn, floor, Deepen LPs, or holder airdrop is on. Leftover hook tax goes to the protocol.
        </p>
      )}

      {routes.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4">
          {routes.map((key) => {
            const hook = hookForRoute(key);
            if (!hook) return null;
            const share = getFeeRouteValue(modules, key);
            const swapBps = feeRouteSwapBps(modules, hookTaxBps, key);
            const accent = hookAccentColor(hook.id);
            return (
              <div key={key} className="pick-config-control">
                <div className="pick-config-control-head">
                  <span className="pick-config-control-label fee-split-row-title">
                    <HookLogo hookId={hook.id} theme={hook.theme} />
                    {hook.title}
                  </span>
                  <span
                    className={cn(
                      "pick-config-control-value orb-hook-desc-badge",
                      `orb-hook-desc-badge--${hook.theme}`,
                    )}
                  >
                    {solo ? "100%" : `${share}%`}
                  </span>
                </div>
                {solo ? null : (
                  <div className="pick-config-control-track">
                    <AccentSlider
                      accentColor={accent}
                      value={[share]}
                      onValueChange={([v]) => onUpdate(setFeeRouteShare(modules, key, v))}
                      min={1}
                      max={feeRouteSliderMax(modules, key)}
                      step={1}
                    />
                  </div>
                )}
                <p className="pick-config-hint" style={{ marginTop: 0 }}>
                  {potBps > 0
                    ? `${swapPctLabel(swapBps)} of each swap goes to ${hook.title.toLowerCase()}`
                    : "Waiting for a hook tax or Creator → Hook"}
                </p>
              </div>
            );
          })}
          {routes.length > 1 ? (
            <p className={cn("pick-config-hint", shareTotal !== 100 && "pick-config-hint--warn")}>
              {shareTotal === 100
                ? "Shares add to 100% of the hook pot"
                : `Shares add to ${shareTotal}%. Need 100%`}
            </p>
          ) : null}
        </div>
      ) : null}

      {modules.buybackVesting ? (
        <p className="pick-config-hint">
          Buyback vesting takes the creator cut separately. {swapPctLabel(creatorCutBps)} of each
          swap vests to you, not this split.
        </p>
      ) : null}
    </div>
  );
}
