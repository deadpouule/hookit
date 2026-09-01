import { BASE_FEE_BPS, DYNAMIC_FEE_DEFAULT_MAX_BPS, MAX_TOTAL_FEE_BPS } from "@/lib/constants";
import type { LaunchModules } from "@/lib/types";

/** Total swap fee floor (1% base — protocol constant). */
export const DYNAMIC_FEE_MIN_BPS = BASE_FEE_BPS;

/** Total swap fee ceiling (base + max hook tax = 10%). */
export const DYNAMIC_FEE_MAX_BPS = MAX_TOTAL_FEE_BPS;

export function totalFeeBps(modules: LaunchModules, hookTaxBps: number): number {
  if (modules.dynamicFees) {
    return modules.dynamicFeeMaxBps ?? DYNAMIC_FEE_DEFAULT_MAX_BPS;
  }
  return BASE_FEE_BPS + hookTaxBps;
}

/** Hook tax encoded on-chain — dynamic mode uses max of the chosen range. */
export function resolveEffectiveHookTaxBps(modules: LaunchModules, hookTaxBps: number): number {
  if (!modules.dynamicFees) return hookTaxBps;
  const maxTotal = modules.dynamicFeeMaxBps ?? DYNAMIC_FEE_DEFAULT_MAX_BPS;
  return Math.max(0, maxTotal - BASE_FEE_BPS);
}

export function resolveDynamicFeeMinBps(modules: LaunchModules): number {
  return Math.max(
    DYNAMIC_FEE_MIN_BPS,
    Math.min(modules.dynamicFeeMinBps ?? DYNAMIC_FEE_MIN_BPS, DYNAMIC_FEE_MAX_BPS),
  );
}

export function resolveDynamicFeeMaxBps(modules: LaunchModules, hookTaxBps: number): number {
  const fallback = Math.max(DYNAMIC_FEE_DEFAULT_MAX_BPS, BASE_FEE_BPS + hookTaxBps);
  return Math.max(
    DYNAMIC_FEE_MIN_BPS,
    Math.min(modules.dynamicFeeMaxBps ?? fallback, DYNAMIC_FEE_MAX_BPS),
  );
}

export function formatTotalFeePercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatDynamicFeeRange(modules: LaunchModules, hookTaxBps = 0): string {
  const min = resolveDynamicFeeMinBps(modules);
  const max = resolveDynamicFeeMaxBps(modules, hookTaxBps);
  return `${formatTotalFeePercent(min)} – ${formatTotalFeePercent(max)}`;
}

export function clampDynamicFeeRange(
  minBps: number,
  maxBps: number,
): { dynamicFeeMinBps: number; dynamicFeeMaxBps: number; hookTaxBps: number } {
  const min = Math.max(DYNAMIC_FEE_MIN_BPS, Math.min(minBps, DYNAMIC_FEE_MAX_BPS - 10));
  const max = Math.max(min + 10, Math.min(maxBps, DYNAMIC_FEE_MAX_BPS));
  return {
    dynamicFeeMinBps: min,
    dynamicFeeMaxBps: max,
    hookTaxBps: max - BASE_FEE_BPS,
  };
}
