import type { LaunchModules } from "@/lib/types";

/** Percent fields that split the hook-tax pot (must sum to 100 when multiple are on). */
export type FeeRouteKey = "floorAllocation" | "autoBurnPct" | "lpDonatePct" | "holderAirdropPct";

const FEE_ROUTE_KEYS: FeeRouteKey[] = [
  "floorAllocation",
  "autoBurnPct",
  "lpDonatePct",
  "holderAirdropPct",
];

export function isFeeRouteKey(key: keyof LaunchModules): key is FeeRouteKey {
  return FEE_ROUTE_KEYS.includes(key as FeeRouteKey);
}

export function feeRouteEnabled(modules: LaunchModules, key: FeeRouteKey): boolean {
  switch (key) {
    case "floorAllocation":
      return modules.backedFloor;
    case "autoBurnPct":
      return modules.autoBurn;
    case "lpDonatePct":
      return modules.lpDonate;
    case "holderAirdropPct":
      return modules.holderAirdrop;
  }
}

export function listEnabledFeeRoutes(modules: LaunchModules): FeeRouteKey[] {
  return FEE_ROUTE_KEYS.filter((key) => feeRouteEnabled(modules, key));
}

export function getFeeRouteValue(modules: LaunchModules, key: FeeRouteKey): number {
  return modules[key];
}

/** Sum of active fee-route shares (target is always 100). */
export function feeRouteTotalPct(modules: LaunchModules): number {
  return listEnabledFeeRoutes(modules).reduce((sum, key) => sum + getFeeRouteValue(modules, key), 0);
}

/** True when no fee-route modules are on, or enabled shares total exactly 100%. */
export function feeRouteIsComplete(modules: LaunchModules): boolean {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length === 0) return true;
  return feeRouteTotalPct(modules) === 100;
}

function splitIntegerTotal(keys: FeeRouteKey[], weights: number[], total: number): Partial<LaunchModules> {
  if (keys.length === 0) return {};
  if (keys.length === 1) {
    return { [keys[0]]: total } as Partial<LaunchModules>;
  }

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const patch: Partial<LaunchModules> = {};
  let assigned = 0;

  if (weightSum <= 0) {
    const base = Math.floor(total / keys.length);
    let remainder = total - base * keys.length;
    for (const key of keys) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      patch[key] = base + extra;
      assigned += patch[key]!;
    }
    return patch;
  }

  const raw = keys.map((key, i) => ({
    key,
    exact: (weights[i] / weightSum) * total,
  }));
  const floors = raw.map(({ key, exact }) => {
    const value = Math.floor(exact);
    assigned += value;
    return { key, value, frac: exact - value };
  });
  let leftover = total - assigned;
  floors.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < floors.length && leftover > 0; i += 1, leftover -= 1) {
    floors[i].value += 1;
  }
  for (const { key, value } of floors) {
    patch[key] = value;
  }
  return patch;
}

/** Equal 100% split when a new fee-route module is turned on. */
export function rebalanceFeeRoutes(modules: LaunchModules): Partial<LaunchModules> {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length === 0) return {};
  const weights = enabled.map((key) => Math.max(1, getFeeRouteValue(modules, key)));
  return splitIntegerTotal(enabled, weights, 100);
}

/** User moved one slider — keep the total at 100% across enabled modules. */
export function setFeeRouteShare(
  modules: LaunchModules,
  changedKey: FeeRouteKey,
  nextPct: number,
): Partial<LaunchModules> {
  const enabled = listEnabledFeeRoutes(modules);
  if (!enabled.includes(changedKey)) return {};

  if (enabled.length === 1) {
    return { [changedKey]: 100 } as Partial<LaunchModules>;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(nextPct)));
  const others = enabled.filter((key) => key !== changedKey);

  if (clamped >= 100) {
    const patch: Partial<LaunchModules> = { [changedKey]: 100 };
    for (const key of others) patch[key] = 0;
    return patch;
  }

  const weights = others.map((key) => Math.max(0, getFeeRouteValue(modules, key)));
  return {
    [changedKey]: clamped,
    ...splitIntegerTotal(others, weights, 100 - clamped),
  };
}

export function feeRouteSliderMax(modules: LaunchModules, key: FeeRouteKey): number {
  const enabled = listEnabledFeeRoutes(modules);
  if (enabled.length <= 1) return 100;
  const othersMin = (enabled.length - 1) * 1;
  return Math.max(1, 100 - othersMin);
}
