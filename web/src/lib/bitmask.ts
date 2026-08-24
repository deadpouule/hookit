import type { LaunchModules } from "@/lib/types";

const FLAG_ANTI_SNIPE = BigInt(1) << BigInt(0);
const FLAG_BACKED_FLOOR = BigInt(1) << BigInt(1);
const FLAG_ANTI_MEV = BigInt(1) << BigInt(2);
const FLAG_MAX_TX = BigInt(1) << BigInt(3);
const FLAG_MAX_WALLET = BigInt(1) << BigInt(4);

const SHIFT_CREATOR_TAX = BigInt(7);
const SHIFT_SNIPE_DURATION = BigInt(23);
const SHIFT_MAX_TX = BigInt(39);
const SHIFT_MAX_WALLET = BigInt(55);
const SHIFT_FLOOR_ALLOC = BigInt(71);
const SHIFT_INITIAL_SNIPE_TAX = BigInt(95);

const MAX_CREATOR_TAX_BPS = BigInt(1000);
const MAX_SNIPE_TAX_BPS = BigInt(9900);

/** Packs UI module config into the on-chain uint256 bitmask (matches BitmaskConfig.sol). */
export function packLaunchBitmask(
  modules: LaunchModules,
  creatorTaxBps: number,
): bigint {
  if (creatorTaxBps > Number(MAX_CREATOR_TAX_BPS)) {
    throw new Error("Creator tax exceeds protocol maximum (10%)");
  }

  const initialSnipeTaxBps = BigInt(Math.min(modules.antiSnipeInitialTax * 100, 9900));
  if (initialSnipeTaxBps > MAX_SNIPE_TAX_BPS) {
    throw new Error("Snipe tax too high");
  }

  const floorAllocationBps = BigInt(modules.floorAllocation * 100);

  let packed = BigInt(0);
  if (modules.antiSnipe) packed |= FLAG_ANTI_SNIPE;
  if (modules.backedFloor) packed |= FLAG_BACKED_FLOOR;
  if (modules.antiMev) packed |= FLAG_ANTI_MEV;
  if (modules.maxTx) packed |= FLAG_MAX_TX;
  if (modules.maxWallet) packed |= FLAG_MAX_WALLET;

  packed |= BigInt(creatorTaxBps) << SHIFT_CREATOR_TAX;
  packed |= BigInt(modules.antiSnipeDuration) << SHIFT_SNIPE_DURATION;
  packed |= BigInt(modules.maxTxBps) << SHIFT_MAX_TX;
  packed |= BigInt(modules.maxWalletBps) << SHIFT_MAX_WALLET;
  packed |= floorAllocationBps << SHIFT_FLOOR_ALLOC;
  packed |= initialSnipeTaxBps << SHIFT_INITIAL_SNIPE_TAX;

  return packed;
}

const UINT16_MASK = BigInt(0xffff);
const UINT24_MASK = BigInt(0xffffff);

export interface UnpackedBitmask {
  modules: LaunchModules;
  creatorTaxBps: number;
}

/** Unpacks on-chain bitmask into UI module config (matches BitmaskConfig.sol). */
export function unpackLaunchBitmask(packed: bigint): UnpackedBitmask {
  const antiSnipe = (packed & FLAG_ANTI_SNIPE) !== BigInt(0);
  const backedFloor = (packed & FLAG_BACKED_FLOOR) !== BigInt(0);
  const antiMev = (packed & FLAG_ANTI_MEV) !== BigInt(0);
  const maxTx = (packed & FLAG_MAX_TX) !== BigInt(0);
  const maxWallet = (packed & FLAG_MAX_WALLET) !== BigInt(0);

  const creatorTaxBps = Number((packed >> SHIFT_CREATOR_TAX) & UINT16_MASK);
  const antiSnipeDuration = Number((packed >> SHIFT_SNIPE_DURATION) & UINT16_MASK);
  const maxTxBps = Number((packed >> SHIFT_MAX_TX) & UINT16_MASK);
  const maxWalletBps = Number((packed >> SHIFT_MAX_WALLET) & UINT16_MASK);
  const floorAllocationBps = Number((packed >> SHIFT_FLOOR_ALLOC) & UINT24_MASK);
  let initialSnipeTaxBps = Number((packed >> SHIFT_INITIAL_SNIPE_TAX) & UINT16_MASK);
  if (initialSnipeTaxBps === 0 && antiSnipe) initialSnipeTaxBps = 5000;

  return {
    creatorTaxBps,
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
    },
  };
}
