/**
 * Launch UI limits aligned with `ProtocolConstants.sol` (next deploy).
 * Launchers pick values in these ranges; config is fixed in the bitmask at launch.
 */

/** Max tx / max wallet: 0.1%–2.5% of total supply (10–250 bps). */
export const MIN_SUPPLY_CAP_BPS = 10;
export const MAX_SUPPLY_CAP_BPS = 250;
export const MIN_SUPPLY_CAP_SLIDER_PCT = 0.1;
export const MAX_SUPPLY_CAP_SLIDER_PCT = 2.5;

export const MAX_SNIPE_TAX_BPS = 9_900;
export const MAX_DEV_BUY_BPS = 250;

export const MIN_ANTI_SNIPE_TAX_PCT = 1;
export const MAX_ANTI_SNIPE_TAX_PCT = MAX_SNIPE_TAX_BPS / 100;

export const MIN_ANTI_SNIPE_DURATION_SEC = 1;
export const MAX_ANTI_SNIPE_DURATION_SEC = 3600;

export const HOLDER_AIRDROP_EPOCH_MINUTES = 15;
export const DYNAMIC_FEE_WINDOW_HOURS = 24;

export function bpsToSupplyPct(bps: number): number {
  return bps / 100;
}

export function supplyPctToBps(pct: number): number {
  return Math.round(pct * 100);
}

export function formatSupplyCap(bps: number): string {
  const pct = bpsToSupplyPct(bps);
  if (pct < 1) return `${pct.toFixed(1)}%`;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export function clampSupplyCapBps(bps: number): number {
  return Math.max(MIN_SUPPLY_CAP_BPS, Math.min(MAX_SUPPLY_CAP_BPS, bps));
}
