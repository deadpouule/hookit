import type { LaunchModules } from "@/lib/types";
import { resolveEffectiveHookTaxBps } from "@/lib/fee-range";
import {
  MAX_SUPPLY_CAP_BPS,
  MIN_SUPPLY_CAP_BPS,
  MAX_SUPPLY_CAP_SLIDER_PCT,
  MIN_SUPPLY_CAP_SLIDER_PCT,
} from "@/lib/protocol-limits";

const FLAG_ANTI_SNIPE = BigInt(1) << BigInt(0);
const FLAG_BACKED_FLOOR = BigInt(1) << BigInt(1);
const FLAG_ANTI_MEV = BigInt(1) << BigInt(2);
const FLAG_MAX_TX = BigInt(1) << BigInt(3);
const FLAG_MAX_WALLET = BigInt(1) << BigInt(4);
const FLAG_DYNAMIC_FEES = BigInt(1) << BigInt(5);
const FLAG_BUYBACK_VESTING = BigInt(1) << BigInt(6);
const FLAG_AUTO_BURN = BigInt(1) << BigInt(111);
const FLAG_LP_DONATE = BigInt(1) << BigInt(112);
const FLAG_HOLDER_AIRDROP = BigInt(1) << BigInt(145);
const FLAG_CREATOR_SHARE_TO_HOOK = BigInt(1) << BigInt(162);

const SHIFT_HOOK_TAX = BigInt(7);
const SHIFT_SNIPE_DURATION = BigInt(23);
const SHIFT_MAX_TX = BigInt(39);
const SHIFT_MAX_WALLET = BigInt(55);
const SHIFT_FLOOR_ALLOC = BigInt(71);
const SHIFT_INITIAL_SNIPE_TAX = BigInt(95);
const SHIFT_AUTO_BURN_BPS = BigInt(113);
const SHIFT_LP_DONATE_BPS = BigInt(129);
const SHIFT_HOLDER_AIRDROP_BPS = BigInt(146);
const SHIFT_BUYBACK_VESTING_DURATION = BigInt(163);
const SHIFT_DYNAMIC_FEE_MIN_TOTAL = BigInt(195);
const FLAG_DYNAMIC_FEE_RAMP_UP = BigInt(1) << BigInt(211);
const SHIFT_DYNAMIC_FEE_DEPTH_SATURATION = BigInt(212);
const SHIFT_HOLDER_AIRDROP_EPOCH = BigInt(228);

const MAX_HOOK_TAX_BPS = BigInt(900);
const MAX_TOTAL_FEE_BPS = BigInt(1000);
const MAX_SNIPE_TAX_BPS = BigInt(9900);
const MIN_BUYBACK_VESTING_DAYS = 7;
const MAX_BUYBACK_VESTING_DAYS = 365 * 5;
const SECONDS_PER_DAY = 86_400;

/** Packs UI module config into the on-chain uint256 bitmask (matches BitmaskConfig.sol). */
export function packLaunchBitmask(modules: LaunchModules, hookTaxBps: number): bigint {
  const effectiveHookTax = resolveEffectiveHookTaxBps(modules, hookTaxBps);

  if (modules.dynamicFees) {
    const min = modules.dynamicFeeMinBps ?? 100;
    const max = modules.dynamicFeeMaxBps ?? 300;
    if (min < 100 || max > Number(MAX_TOTAL_FEE_BPS) || max < min + 10) {
      throw new Error("Dynamic fee range must be 1.00%–10.00% with max at least 0.10% above min");
    }
  }

  if (effectiveHookTax > Number(MAX_HOOK_TAX_BPS)) {
    throw new Error("Hook tax exceeds protocol maximum (9%, so base+tax ≤ 10%)");
  }
  if (100 + effectiveHookTax > Number(MAX_TOTAL_FEE_BPS)) {
    throw new Error("Base fee + hook tax cannot exceed 10%");
  }

  const initialSnipeTaxBps = BigInt(Math.min(modules.antiSnipeInitialTax * 100, 9900));
  if (initialSnipeTaxBps > MAX_SNIPE_TAX_BPS) {
    throw new Error("Snipe tax too high");
  }

  if (modules.antiSnipe) {
    const openBps = 100 + effectiveHookTax + modules.antiSnipeInitialTax * 100;
    if (openBps > 10_000) {
      throw new Error("Anti-snipe + base fee + hook tax cannot exceed 100% at open");
    }
  }

  if (modules.maxTx && (modules.maxTxBps < MIN_SUPPLY_CAP_BPS || modules.maxTxBps > MAX_SUPPLY_CAP_BPS)) {
    throw new Error(`Max tx must be between ${MIN_SUPPLY_CAP_SLIDER_PCT}% and ${MAX_SUPPLY_CAP_SLIDER_PCT}% of supply`);
  }
  if (modules.maxWallet && (modules.maxWalletBps < MIN_SUPPLY_CAP_BPS || modules.maxWalletBps > MAX_SUPPLY_CAP_BPS)) {
    throw new Error(
      `Max wallet must be between ${MIN_SUPPLY_CAP_SLIDER_PCT}% and ${MAX_SUPPLY_CAP_SLIDER_PCT}% of supply`,
    );
  }

  if (modules.holderAirdrop) {
    const epochSec = modules.holderAirdropEpochSeconds ?? 15 * 60;
    if (epochSec < 60 || epochSec > 7 * 24 * 3600) {
      throw new Error("Holder airdrop epoch must be 1 minute to 7 days");
    }
  }
    throw new Error("Hook pot shares are capped at 100% each");
  }

  const floorAllocationBps = BigInt(modules.floorAllocation * 100);
  const autoBurnBps = BigInt(modules.autoBurnPct * 100);
  const lpDonateBps = BigInt(modules.lpDonatePct * 100);
  const holderAirdropBps = BigInt(modules.holderAirdropPct * 100);

  let routed = 0;
  if (modules.backedFloor) routed += modules.floorAllocation;
  if (modules.autoBurn) routed += modules.autoBurnPct;
  if (modules.lpDonate) routed += modules.lpDonatePct;
  if (modules.holderAirdrop) routed += modules.holderAirdropPct;
  if (routed > 100) {
    throw new Error("Floor + Auto Burn + LP Donate + Holder Airdrop cannot exceed 100% of hook tax");
  }
  const feeRouteCount =
    (modules.backedFloor ? 1 : 0) +
    (modules.autoBurn ? 1 : 0) +
    (modules.lpDonate ? 1 : 0) +
    (modules.holderAirdrop ? 1 : 0);
  if (feeRouteCount > 0 && routed !== 100) {
    throw new Error("Fee routes must total exactly 100% of the hook tax — nothing left unallocated");
  }
  if (routed > 0 && effectiveHookTax === 0 && !modules.creatorShareToHook) {
    throw new Error(
      "Enable a hook tax and/or route creator base fees to the hook when using floor / burn / donate / airdrop",
    );
  }

  if (modules.buybackVesting) {
    const days = modules.buybackVestingDurationDays ?? MAX_BUYBACK_VESTING_DAYS;
    if (days < MIN_BUYBACK_VESTING_DAYS || days > MAX_BUYBACK_VESTING_DAYS) {
      throw new Error(`Buyback vesting duration must be ${MIN_BUYBACK_VESTING_DAYS}–${MAX_BUYBACK_VESTING_DAYS} days`);
    }
  }

  let packed = BigInt(0);
  if (modules.antiSnipe) packed |= FLAG_ANTI_SNIPE;
  if (modules.backedFloor) packed |= FLAG_BACKED_FLOOR;
  if (modules.antiMev) packed |= FLAG_ANTI_MEV;
  if (modules.maxTx) packed |= FLAG_MAX_TX;
  if (modules.maxWallet) packed |= FLAG_MAX_WALLET;
  if (modules.dynamicFees) packed |= FLAG_DYNAMIC_FEES;
  if (modules.buybackVesting) packed |= FLAG_BUYBACK_VESTING;
  if (modules.autoBurn) packed |= FLAG_AUTO_BURN;
  if (modules.lpDonate) packed |= FLAG_LP_DONATE;
  if (modules.holderAirdrop) packed |= FLAG_HOLDER_AIRDROP;
  if (modules.creatorShareToHook) packed |= FLAG_CREATOR_SHARE_TO_HOOK;

  packed |= BigInt(effectiveHookTax) << SHIFT_HOOK_TAX;
  packed |= BigInt(modules.antiSnipeDuration) << SHIFT_SNIPE_DURATION;
  packed |= BigInt(modules.maxTxBps) << SHIFT_MAX_TX;
  packed |= BigInt(modules.maxWalletBps) << SHIFT_MAX_WALLET;
  packed |= floorAllocationBps << SHIFT_FLOOR_ALLOC;
  packed |= initialSnipeTaxBps << SHIFT_INITIAL_SNIPE_TAX;
  packed |= autoBurnBps << SHIFT_AUTO_BURN_BPS;
  packed |= lpDonateBps << SHIFT_LP_DONATE_BPS;
  packed |= holderAirdropBps << SHIFT_HOLDER_AIRDROP_BPS;
  if (modules.buybackVesting) {
    const days = modules.buybackVestingDurationDays ?? MAX_BUYBACK_VESTING_DAYS;
    packed |= BigInt(days * SECONDS_PER_DAY) << SHIFT_BUYBACK_VESTING_DURATION;
  }

  if (modules.dynamicFees) {
    const minTotal = modules.dynamicFeeMinBps ?? 100;
    packed |= BigInt(minTotal) << SHIFT_DYNAMIC_FEE_MIN_TOTAL;
    if (modules.dynamicFeeRampUp !== false) packed |= FLAG_DYNAMIC_FEE_RAMP_UP;
    packed |= BigInt(modules.dynamicFeeDepthSaturationBps ?? 10_000) << SHIFT_DYNAMIC_FEE_DEPTH_SATURATION;
  }

  if (modules.holderAirdrop) {
    const epochSec = modules.holderAirdropEpochSeconds ?? 15 * 60;
    packed |= BigInt(epochSec) << SHIFT_HOLDER_AIRDROP_EPOCH;
  }

  return packed;
}

const UINT16_MASK = BigInt(0xffff);
const UINT24_MASK = BigInt(0xffffff);
const UINT32_MASK = BigInt(0xffffffff);

export interface UnpackedBitmask {
  modules: LaunchModules;
  hookTaxBps: number;
}

/** Unpacks on-chain bitmask into UI module config (matches BitmaskConfig.sol). */
export function unpackLaunchBitmask(packed: bigint): UnpackedBitmask {
  const antiSnipe = (packed & FLAG_ANTI_SNIPE) !== BigInt(0);
  const backedFloor = (packed & FLAG_BACKED_FLOOR) !== BigInt(0);
  const antiMev = (packed & FLAG_ANTI_MEV) !== BigInt(0);
  const maxTx = (packed & FLAG_MAX_TX) !== BigInt(0);
  const maxWallet = (packed & FLAG_MAX_WALLET) !== BigInt(0);
  const dynamicFees = (packed & FLAG_DYNAMIC_FEES) !== BigInt(0);
  const buybackVesting = (packed & FLAG_BUYBACK_VESTING) !== BigInt(0);
  const autoBurn = (packed & FLAG_AUTO_BURN) !== BigInt(0);
  const lpDonate = (packed & FLAG_LP_DONATE) !== BigInt(0);
  const holderAirdrop = (packed & FLAG_HOLDER_AIRDROP) !== BigInt(0);
  const creatorShareToHook = (packed & FLAG_CREATOR_SHARE_TO_HOOK) !== BigInt(0);

  const hookTaxBps = Number((packed >> SHIFT_HOOK_TAX) & UINT16_MASK);
  const antiSnipeDuration = Number((packed >> SHIFT_SNIPE_DURATION) & UINT16_MASK);
  const maxTxBps = Number((packed >> SHIFT_MAX_TX) & UINT16_MASK);
  const maxWalletBps = Number((packed >> SHIFT_MAX_WALLET) & UINT16_MASK);
  const floorAllocationBps = Number((packed >> SHIFT_FLOOR_ALLOC) & UINT24_MASK);
  let initialSnipeTaxBps = Number((packed >> SHIFT_INITIAL_SNIPE_TAX) & UINT16_MASK);
  if (initialSnipeTaxBps === 0 && antiSnipe) initialSnipeTaxBps = 5000;
  const autoBurnBps = Number((packed >> SHIFT_AUTO_BURN_BPS) & UINT16_MASK);
  const lpDonateBps = Number((packed >> SHIFT_LP_DONATE_BPS) & UINT16_MASK);
  const holderAirdropBps = Number((packed >> SHIFT_HOLDER_AIRDROP_BPS) & UINT16_MASK);
  const buybackVestingDurationSeconds = Number((packed >> SHIFT_BUYBACK_VESTING_DURATION) & UINT32_MASK);
  const dynamicFeeMinTotalBps = Number((packed >> SHIFT_DYNAMIC_FEE_MIN_TOTAL) & UINT16_MASK);
  const dynamicFeeRampUp = (packed & FLAG_DYNAMIC_FEE_RAMP_UP) !== BigInt(0);
  const dynamicFeeDepthSaturationBps = Number((packed >> SHIFT_DYNAMIC_FEE_DEPTH_SATURATION) & UINT16_MASK);
  const holderAirdropEpochSecondsRaw = Number((packed >> SHIFT_HOLDER_AIRDROP_EPOCH) & UINT32_MASK);
  const buybackVestingDurationDays = Math.max(
    MIN_BUYBACK_VESTING_DAYS,
    Math.round(buybackVestingDurationSeconds / SECONDS_PER_DAY) || MAX_BUYBACK_VESTING_DAYS,
  );

  return {
    hookTaxBps,
    modules: {
      antiSnipe,
      antiSnipeDuration,
      antiSnipeInitialTax: Math.round(initialSnipeTaxBps / 100),
      backedFloor,
      floorAllocation: Math.round(floorAllocationBps / 100),
      antiMev,
      maxWallet,
      maxWalletBps,
      maxTx,
      maxTxBps,
      dynamicFees,
      dynamicFeeMinBps:
        dynamicFeeMinTotalBps === 0 && dynamicFees ? 100 : dynamicFeeMinTotalBps || undefined,
      dynamicFeeMaxBps: dynamicFees ? 100 + hookTaxBps : undefined,
      dynamicFeeRampUp: dynamicFees ? dynamicFeeRampUp : undefined,
      dynamicFeeDepthSaturationBps:
        dynamicFees && dynamicFeeDepthSaturationBps > 0
          ? dynamicFeeDepthSaturationBps
          : dynamicFees
            ? 10_000
            : undefined,
      buybackVesting,
      buybackVestingDurationDays,
      autoBurn,
      autoBurnPct: autoBurnBps === 0 ? 20 : Math.max(1, Math.round(autoBurnBps / 100)),
      lpDonate,
      lpDonatePct: lpDonateBps === 0 ? 20 : Math.max(1, Math.round(lpDonateBps / 100)),
      holderAirdrop,
      holderAirdropPct:
        holderAirdropBps === 0 ? 50 : Math.max(1, Math.round(holderAirdropBps / 100)),
      holderAirdropEpochSeconds:
        holderAirdrop && holderAirdropEpochSecondsRaw > 0
          ? holderAirdropEpochSecondsRaw
          : holderAirdrop
            ? 15 * 60
            : undefined,
      creatorShareToHook,
    },
  };
}
