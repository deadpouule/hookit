import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  Coins,
  EyeOff,
  Flame,
  Gauge,
  Gift,
  Hourglass,
  Layers,
  Percent,
  Shield,
  TrendingUp,
} from "lucide-react";

import { unpackLaunchBitmask } from "@/lib/bitmask";
import { rebalanceFeeRoutes } from "@/lib/hook-fee-route";
import type { LaunchModules, TokenPool } from "@/lib/types";

export type MasterHookCategory = "trading-fees" | "protection" | "tokenomics" | "rewards";

export type MasterHookId =
  | "anti-snipe"
  | "backed-floor"
  | "anti-mev"
  | "max-tx"
  | "dynamic-fees"
  | "buyback-vesting"
  | "auto-burn"
  | "deepen-lps"
  | "holder-airdrop"
  | "hook-to-creator"
  | "creator-share-to-hook";

export type BrowseHookId = MasterHookId | "fixed-fee";

export type HookTheme =
  | "fire"
  | "gold"
  | "void"
  | "nature"
  | "volt"
  | "ice"
  | "ember"
  | "rose"
  | "steel"
  | "crimson"
  | "lime"
  | "pearl"
  | "yellow"
  | "teal"
  | "cobalt"
  | "brown"
  | "olive";

/** Slider / accent colors aligned with pick-card hook themes */
export const HOOK_THEME_ACCENT: Record<HookTheme, string> = {
  fire: "#ff0050",
  gold: "#f59e0b",
  void: "#e879f9",
  nature: "#10b981",
  volt: "#03b1ed",
  ice: "#38bdf8",
  ember: "#f97316",
  rose: "#f43f5e",
  steel: "#6366f1",
  crimson: "#dc2626",
  lime: "#84cc16",
  pearl: "#e4e4e7",
  yellow: "#facc15",
  teal: "#2dd4bf",
  cobalt: "#3b82f6",
  brown: "#b45309",
  olive: "#4e561a",
};

export function hookThemeAccentColor(theme: HookTheme): string {
  return HOOK_THEME_ACCENT[theme];
}

export interface MasterHook {
  id: MasterHookId;
  number: number;
  title: string;
  description: string;
  category: MasterHookCategory;
  icon: LucideIcon;
  theme: HookTheme;
  keyword: string;
  creator: string;
  uses: number;
  royalty: string;
  savedAt: string;
  summary: string;
  settings: string[];
}

const CREATOR = "0x5a52c8d3e91f00004aA2";

export const MASTER_HOOK_FILTERS: { id: "all" | MasterHookCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "protection", label: "Protection" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "rewards", label: "Rewards" },
  { id: "trading-fees", label: "Trading Fees" },
];

export const MASTER_HOOKS: MasterHook[] = [
  {
    id: "holder-airdrop",
    number: 10,
    title: "Holder Airdrop",
    description: "Every swap accrues. Holders get quote or stocks on a time window or FDV target",
    category: "rewards",
    icon: Gift,
    theme: "gold",
    keyword: "AIRDROP",
    creator: CREATOR,
    uses: 0,
    royalty: "0% of hook fees",
    savedAt: "Block  - ",
    summary: "quote fee share • auto epoch airdrop",
    settings: [
      "+ ROUTE QUOTE FEES TO VAULT",
      "+ AIRDROP ON SWAP AFTER 15M",
      "+ PRO-RATA BY TOKEN BALANCE",
    ],
  },
  {
    id: "backed-floor",
    number: 2,
    title: "Backed Floor",
    description: "every swap the floor goes up - so the price can only go up. More volume = higher floor",
    category: "protection",
    icon: Layers,
    theme: "olive",
    keyword: "FLOOR",
    creator: CREATOR,
    uses: 9,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,220",
    summary: "1 active hook block • vault-backed P_floor",
    settings: ["+ QUOTE COLLATERAL IN FLOORVAULT", "+ P_FLOOR = VAULT / CIRCULATING", "+ RATCHET NEVER DECREASES"],
  },
  {
    id: "buyback-vesting",
    number: 3,
    title: "Buyback Vesting",
    description: "creator proceeds vest on a timer, or until a market-cap target",
    category: "tokenomics",
    icon: Hourglass,
    theme: "void",
    keyword: "VEST",
    creator: CREATOR,
    uses: 4,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,640",
    summary: "1 active hook block • time vest or unlock-at-mcap",
    settings: [
      "+ CREATOR CUT TO BUYBACKVAULT",
      "+ TIME VEST OR UNTIL MCAP",
      "+ CLAIM AFTER UNLOCK",
    ],
  },
  {
    id: "dynamic-fees",
    number: 4,
    title: "Dynamic Fees",
    description: "Swap fee scales with in-range LP depth consumed. Larger trades pay more, no oracle",
    category: "trading-fees",
    icon: TrendingUp,
    theme: "ember",
    keyword: "FEE",
    creator: CREATOR,
    uses: 5,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,560",
    summary: "1 active hook block • DYNAMIC_FEE_FLAG 0x800000",
    settings: ["+ 24H ROLLING QUOTE VOLUME", "+ MIN–MAX FEE RANGE", "+ RISE OR FALL WITH ACTIVITY"],
  },
  {
    id: "deepen-lps",
    number: 9,
    title: "Deepen LPs",
    description: "share of hook tax minted into the pool as extra liquidity. Deeper book for whales and traders",
    category: "protection",
    icon: Coins,
    theme: "nature",
    keyword: "LP",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,801",
    summary: "1 active hook block • hook-tax LP deepen",
    settings: ["+ % OF HOOK TAX POT", "+ MINTS INTO LAUNCH LP RANGE", "+ DEEPER BOOK FOR SWAPS"],
  },
  {
    id: "auto-burn",
    number: 8,
    title: "Auto-Burn",
    description: "share of hook tax buys tokens from the pool and burns them after each swap",
    category: "tokenomics",
    icon: Flame,
    theme: "crimson",
    keyword: "BURN",
    creator: CREATOR,
    uses: 4,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,680",
    summary: "1 active hook block • hook-tax buyback burn",
    settings: ["+ % OF HOOK TAX POT", "+ BUYBACK AFTER SWAP", "+ TOKENS SENT TO DEAD ADDRESS"],
  },
  {
    id: "anti-mev",
    number: 7,
    title: "Anti-MEV",
    description: "same-block opposing swap cooldown",
    category: "protection",
    icon: EyeOff,
    theme: "steel",
    keyword: "MEV",
    creator: CREATOR,
    uses: 8,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,318",
    summary: "1 active hook block • same-tx + same-block guard",
    settings: ["+ SAME-BLOCK OPPOSING SWAP COOLDOWN", "+ TRANSIENT STORAGE GUARD", "+ PER-ORIGIN BLOCK LOCK"],
  },
  {
    id: "anti-snipe",
    number: 1,
    title: "Anti-Snipe",
    description: "decay tax on opening buys, fades over the launch window",
    category: "protection",
    icon: Shield,
    theme: "fire",
    keyword: "SNIPE",
    creator: CREATOR,
    uses: 11,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,104",
    summary: "1 active hook block • 50% initial snipe tax",
    settings: ["+ DECAY TAX ON OPENING BUYS", "+ INITIAL TAX 50%", "+ FADES OVER LAUNCH WINDOW"],
  },
  {
    id: "max-tx",
    number: 5,
    title: "Max Tx",
    description: "caps each swap between 0.1% and 2.5% of total supply. Fixed at launch",
    category: "protection",
    icon: Gauge,
    theme: "lime",
    keyword: "TX",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,401",
    summary: "1 active hook block • per-swap supply cap",
    settings: ["+ MAX TX BPS ON", "+ CAP PER SWAP VS SUPPLY", "+ REVERTS OVERSIZE SWAPS"],
  },
  {
    id: "hook-to-creator",
    number: 12,
    title: "Hook → Creator",
    description: "send a share of the hook tax to the creator. Split 100% with burn, floor, Deepen LPs, airdrop",
    category: "rewards",
    icon: ArrowDownToLine,
    theme: "crimson",
    keyword: "CREATOR",
    creator: CREATOR,
    uses: 0,
    royalty: "0% of hook fees",
    savedAt: "Block  - ",
    summary: "hook pot → creator escrow or vest",
    settings: [
      "+ % OF HOOK TAX POT",
      "+ 100% ALONE, SPLIT WITH SINKS",
      "+ VESTS IF BUYBACK VESTING IS ON",
    ],
  },
  {
    id: "creator-share-to-hook",
    number: 11,
    title: "Creator → Hook",
    description: "send your 60% of the base 1% into the hook pot instead of claiming escrow",
    category: "rewards",
    icon: Percent,
    theme: "yellow",
    keyword: "CREATOR",
    creator: CREATOR,
    uses: 0,
    royalty: "0% of hook fees",
    savedAt: "Block  - ",
    summary: "creator base share → hook modules",
    settings: [
      "+ BASE FEE STILL 1%",
      "+ YOUR 60% JOINS HOOK POT",
      "+ SAME MODULE SPLIT AS HOOK TAX",
    ],
  },
];

export interface BrowseHook extends Omit<MasterHook, "id"> {
  id: BrowseHookId;
}

export const FIXED_FEE_HOOK: BrowseHook = {
  id: "fixed-fee",
  number: 12,
  title: "Fixed Fees",
  description: "flat extra fee on every swap. Deducted in quote only, zero sell pressure",
  category: "trading-fees",
  icon: Gauge,
  theme: "cobalt",
  keyword: "FIXED",
  creator: CREATOR,
  uses: 0,
  royalty: "0% of hook fees",
  savedAt: "Block  - ",
  summary: "1% base + fixed hook tax on swaps",
  settings: [
    "+ FLAT HOOK TAX ON SWAPS",
    "+ QUOTE-ONLY DEDUCTION",
    "+ MUST PICK A 100% DESTINATION",
  ],
};

const dynamicFeesIndex = MASTER_HOOKS.findIndex((hook) => hook.id === "dynamic-fees");

export const EXPLORE_HOOKS: BrowseHook[] = [
  ...MASTER_HOOKS.slice(0, dynamicFeesIndex + 1).map((hook) => ({ ...hook })),
  FIXED_FEE_HOOK,
  ...MASTER_HOOKS.slice(dynamicFeesIndex + 1).map((hook) => ({ ...hook })),
];

export function isBrowseHookId(value: string | null): value is BrowseHookId {
  return value === "fixed-fee" || isMasterHookId(value);
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const HOOK_MODULE_FIELD: Record<MasterHookId, keyof LaunchModules> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-tx": "maxTx",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "deepen-lps": "deepenLps",
  "holder-airdrop": "holderAirdrop",
  "hook-to-creator": "hookToCreator",
  "creator-share-to-hook": "creatorShareToHook",
};

const POOL_HOOK_BY_MASTER_ID: Record<MasterHookId, keyof TokenPool["hooks"]> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-tx": "maxTx",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "deepen-lps": "deepenLps",
  "holder-airdrop": "holderAirdrop",
  "hook-to-creator": "hookToCreator",
  "creator-share-to-hook": "creatorShareToHook",
};

type HookUsagePool = {
  hookType?: string;
  bitmask?: string;
  hookTaxBps?: number;
  modules?: Partial<LaunchModules>;
  hooks: {
    antiSnipe?: boolean;
    backedFloor?: boolean;
    antiMev?: boolean;
    maxTx?: boolean;
    dynamicFees?: boolean;
    buybackVesting?: boolean;
    autoBurn?: boolean;
    deepenLps?: boolean;
    holderAirdrop?: boolean;
    hookToCreator?: boolean;
    creatorShareToHook?: boolean;
    customHook?: boolean;
  };
};

function isClassicOrCustom(pool: HookUsagePool): boolean {
  return pool.hookType === "Classic" || Boolean(pool.hooks.customHook);
}

function modulesFromBitmask(bitmask?: string): LaunchModules | null {
  if (!bitmask) return null;
  try {
    return unpackLaunchBitmask(BigInt(bitmask)).modules;
  } catch {
    return null;
  }
}

/** True when a Master pool enabled this module (flags, unpacked modules, or bitmask). */
export function poolEnablesMasterHook(pool: HookUsagePool, hookId: MasterHookId): boolean {
  if (isClassicOrCustom(pool)) return false;
  const field = HOOK_MODULE_FIELD[hookId];
  if (pool.modules && Boolean(pool.modules[field])) return true;
  const hookKey = POOL_HOOK_BY_MASTER_ID[hookId];
  if (pool.hooks[hookKey]) return true;
  return Boolean(modulesFromBitmask(pool.bitmask)?.[field]);
}

/** Count how many listed pools enable each master hook module. */
export function countHookUsage(pools: HookUsagePool[]): Record<MasterHookId, number> {
  const counts: Record<MasterHookId, number> = {
    "anti-snipe": 0,
    "backed-floor": 0,
    "anti-mev": 0,
    "max-tx": 0,
    "dynamic-fees": 0,
    "buyback-vesting": 0,
    "auto-burn": 0,
    "deepen-lps": 0,
    "holder-airdrop": 0,
    "hook-to-creator": 0,
    "creator-share-to-hook": 0,
  };
  for (const pool of pools) {
    for (const hookId of Object.keys(counts) as MasterHookId[]) {
      if (poolEnablesMasterHook(pool, hookId)) counts[hookId] += 1;
    }
  }
  return counts;
}

/** Master pools that enabled a given hook module (same rules as countHookUsage). */
export function poolsUsingMasterHook(pools: TokenPool[], hookId: MasterHookId): TokenPool[] {
  return pools.filter((pool) => poolEnablesMasterHook(pool, hookId));
}

/** Pools that match any of the selected master hook modules. */
export function poolsMatchingAnyMasterHooks(pools: TokenPool[], hookIds: MasterHookId[]): TokenPool[] {
  if (hookIds.length === 0) {
    return pools.filter((pool) => !isClassicOrCustom(pool));
  }

  const seen = new Set<string>();
  const matched: TokenPool[] = [];

  for (const hookId of hookIds) {
    for (const pool of poolsUsingMasterHook(pools, hookId)) {
      const key = pool.contractAddress ?? pool.id;
      if (seen.has(key)) continue;
      seen.add(key);
      matched.push(pool);
    }
  }

  return matched;
}

export function masterHookIdsForPool(pool: TokenPool): MasterHookId[] {
  return (Object.keys(POOL_HOOK_BY_MASTER_ID) as MasterHookId[]).filter((hookId) =>
    poolEnablesMasterHook(pool, hookId),
  );
}

export function isMasterHookId(value: string | null): value is MasterHookId {
  return !!value && value in HOOK_MODULE_FIELD;
}

export function launchWithHookHref(id: BrowseHookId) {
  return `/launch/custom?hook=${id}`;
}

export function parseLaunchHookIds(hook?: string | null, hooks?: string | null): string[] {
  const fromList = (hooks ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const single = hook?.trim();
  if (single && !fromList.includes(single)) fromList.push(single);
  return fromList;
}

export function hookAccentColor(id: MasterHookId): string {
  const hook = MASTER_HOOKS.find((item) => item.id === id);
  return hook ? hookThemeAccentColor(hook.theme) : "#9514d1";
}

export function withMasterHookEnabled(
  state: import("@/lib/types").LaunchFormState,
  hookId: string | null,
): import("@/lib/types").LaunchFormState {
  if (hookId === "fixed-fee") {
    return {
      ...state,
      hookMode: "master",
      hookTaxBps: state.hookTaxBps > 0 ? state.hookTaxBps : 50,
      modules: { ...state.modules, dynamicFees: false },
    };
  }
  if (!isMasterHookId(hookId)) return state;
  const field = HOOK_MODULE_FIELD[hookId];
  const nextModules = { ...state.modules, [field]: true };
  const isFeeRoute =
    hookId === "backed-floor" ||
    hookId === "auto-burn" ||
    hookId === "deepen-lps" ||
    hookId === "holder-airdrop" ||
    hookId === "hook-to-creator";
  return {
    ...state,
    hookMode: "master",
    modules: isFeeRoute ? { ...nextModules, ...rebalanceFeeRoutes(nextModules) } : nextModules,
  };
}

export function withMasterHooksEnabled(
  state: import("@/lib/types").LaunchFormState,
  hookIds: readonly string[],
): import("@/lib/types").LaunchFormState {
  return hookIds.reduce((next, id) => withMasterHookEnabled(next, id), state);
}
