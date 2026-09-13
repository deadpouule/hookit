import type { LucideIcon } from "lucide-react";
import {
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
  Wallet,
} from "lucide-react";

export type MasterHookCategory = "trading-fees" | "protection" | "tokenomics" | "rewards";

export type MasterHookId =
  | "anti-snipe"
  | "backed-floor"
  | "anti-mev"
  | "max-tx"
  | "max-wallet"
  | "dynamic-fees"
  | "buyback-vesting"
  | "auto-burn"
  | "deepen-lps"
  | "holder-airdrop"
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
  | "cobalt";

/** Slider / accent colors aligned with pick-card hook themes */
export const HOOK_THEME_ACCENT: Record<HookTheme, string> = {
  fire: "#ef4444",
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
    savedAt: "Block —",
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
    description: "Ratcheting redeemable floor",
    category: "protection",
    icon: Layers,
    theme: "rose",
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
    settings: ["+ CREATOR CUT TO BUYBACKVAULT", "+ TIME VEST OR UNTIL MCAP", "+ CLAIM AFTER UNLOCK"],
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
    id: "max-wallet",
    number: 6,
    title: "Max Wallet",
    description: "caps each wallet between 0.1% and 2.5% of total supply. Fixed at launch",
    category: "protection",
    icon: Wallet,
    theme: "ice",
    keyword: "WALLET",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,488",
    summary: "1 active hook block • per-wallet supply cap",
    settings: ["+ MAX WALLET BPS ON", "+ CAP PER WALLET VS SUPPLY", "+ CHECKED AFTER BUYS"],
  },
  {
    id: "max-tx",
    number: 5,
    title: "Max Tx",
    description: "caps each swap between 0.1% and 2.5% of total supply. Fixed at launch",
    category: "protection",
    icon: Gauge,
    theme: "yellow",
    keyword: "TX",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,401",
    summary: "1 active hook block • per-swap supply cap",
    settings: ["+ MAX TX BPS ON", "+ CAP PER SWAP VS SUPPLY", "+ REVERTS OVERSIZE SWAPS"],
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
    id: "creator-share-to-hook",
    number: 11,
    title: "Creator → Hook",
    description: "send your 60% of the base 1% into the hook pot instead of claiming escrow",
    category: "rewards",
    icon: Percent,
    theme: "lime",
    keyword: "CREATOR",
    creator: CREATOR,
    uses: 0,
    royalty: "0% of hook fees",
    savedAt: "Block —",
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
  savedAt: "Block —",
  summary: "1% base + fixed hook tax on swaps",
  settings: [
    "+ FLAT HOOK TAX ON SWAPS",
    "+ QUOTE-ONLY DEDUCTION",
    "+ LEFTOVER → PROTOCOL",
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

/** Count how many listed pools enable each master hook module. */
export function countHookUsage(
  pools: Array<{
    hooks: {
      antiSnipe?: boolean;
      backedFloor?: boolean;
      antiMev?: boolean;
      maxTx?: boolean;
      maxWallet?: boolean;
      dynamicFees?: boolean;
      buybackVesting?: boolean;
      autoBurn?: boolean;
      deepenLps?: boolean;
      holderAirdrop?: boolean;
      creatorShareToHook?: boolean;
      customHook?: boolean;
    };
    hookType?: string;
  }>,
): Record<MasterHookId, number> {
  const counts: Record<MasterHookId, number> = {
    "anti-snipe": 0,
    "backed-floor": 0,
    "anti-mev": 0,
    "max-tx": 0,
    "max-wallet": 0,
    "dynamic-fees": 0,
    "buyback-vesting": 0,
    "auto-burn": 0,
    "deepen-lps": 0,
    "holder-airdrop": 0,
    "creator-share-to-hook": 0,
  };
  for (const pool of pools) {
    if (pool.hookType === "Classic" || pool.hooks.customHook) continue;
    if (pool.hooks.antiSnipe) counts["anti-snipe"] += 1;
    if (pool.hooks.backedFloor) counts["backed-floor"] += 1;
    if (pool.hooks.antiMev) counts["anti-mev"] += 1;
    if (pool.hooks.maxTx) counts["max-tx"] += 1;
    if (pool.hooks.maxWallet) counts["max-wallet"] += 1;
    if (pool.hooks.dynamicFees) counts["dynamic-fees"] += 1;
    if (pool.hooks.buybackVesting) counts["buyback-vesting"] += 1;
    if (pool.hooks.autoBurn) counts["auto-burn"] += 1;
    if (pool.hooks.deepenLps) counts["deepen-lps"] += 1;
    if (pool.hooks.holderAirdrop) counts["holder-airdrop"] += 1;
    if (pool.hooks.creatorShareToHook) counts["creator-share-to-hook"] += 1;
  }
  return counts;
}

const POOL_HOOK_BY_MASTER_ID: Partial<
  Record<MasterHookId, keyof import("@/lib/types").TokenPool["hooks"]>
> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-tx": "maxTx",
  "max-wallet": "maxWallet",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "deepen-lps": "deepenLps",
  "holder-airdrop": "holderAirdrop",
  "creator-share-to-hook": "creatorShareToHook",
};

/** Master pools that enabled a given hook module (same rules as countHookUsage). */
export function poolsUsingMasterHook(
  pools: import("@/lib/types").TokenPool[],
  hookId: MasterHookId,
): import("@/lib/types").TokenPool[] {
  const hookKey = POOL_HOOK_BY_MASTER_ID[hookId];
  if (!hookKey) return [];

  return pools.filter((pool) => {
    if (pool.hookType === "Classic" || pool.hooks.customHook) return false;
    return Boolean(pool.hooks[hookKey]);
  });
}

/** Pools that match any of the selected master hook modules. */
export function poolsMatchingAnyMasterHooks(
  pools: import("@/lib/types").TokenPool[],
  hookIds: MasterHookId[],
): import("@/lib/types").TokenPool[] {
  if (hookIds.length === 0) {
    return pools.filter((pool) => pool.hookType !== "Classic" && !pool.hooks.customHook);
  }

  const seen = new Set<string>();
  const matched: import("@/lib/types").TokenPool[] = [];

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

export function masterHookIdsForPool(pool: import("@/lib/types").TokenPool): MasterHookId[] {
  return (Object.entries(POOL_HOOK_BY_MASTER_ID) as [MasterHookId, keyof import("@/lib/types").TokenPool["hooks"]][])
    .filter(([, hookKey]) => Boolean(pool.hooks[hookKey]))
    .map(([hookId]) => hookId);
}

export const HOOK_MODULE_FIELD: Record<
  MasterHookId,
  keyof import("@/lib/types").LaunchModules
> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-tx": "maxTx",
  "max-wallet": "maxWallet",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "deepen-lps": "deepenLps",
  "holder-airdrop": "holderAirdrop",
  "creator-share-to-hook": "creatorShareToHook",
};

export function isMasterHookId(value: string | null): value is MasterHookId {
  return !!value && value in HOOK_MODULE_FIELD;
}

export function launchWithHookHref(id: BrowseHookId) {
  return `/launch/custom?hook=${id}`;
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
  return {
    ...state,
    hookMode: "master",
    modules: { ...state.modules, [field]: true },
  };
}
