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
  | "lp-donate"
  | "holder-airdrop"
  | "creator-share-to-hook";

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
  | "lime";

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
  { id: "trading-fees", label: "Trading Fees" },
  { id: "protection", label: "Protection" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "rewards", label: "Rewards" },
];

export const MASTER_HOOKS: MasterHook[] = [
  {
    id: "anti-snipe",
    number: 1,
    title: "Anti-snipe",
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
    id: "backed-floor",
    number: 2,
    title: "Backed floor",
    description: "ratcheting floor backed by quote in FloorVault",
    category: "protection",
    icon: Layers,
    theme: "gold",
    keyword: "FLOOR",
    creator: CREATOR,
    uses: 9,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,220",
    summary: "1 active hook block • vault-backed P_floor",
    settings: ["+ QUOTE COLLATERAL IN FLOORVAULT", "+ P_FLOOR = VAULT / CIRCULATING", "+ RATCHET NEVER DECREASES"],
  },
  {
    id: "anti-mev",
    number: 3,
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
    id: "max-tx",
    number: 4,
    title: "Max tx",
    description: "caps each swap as a % of total supply",
    category: "protection",
    icon: Gauge,
    theme: "volt",
    keyword: "TX",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,401",
    summary: "1 active hook block • per-swap supply cap",
    settings: ["+ MAX TX BPS ON", "+ CAP PER SWAP VS SUPPLY", "+ REVERTS OVERSIZE SWAPS"],
  },
  {
    id: "max-wallet",
    number: 5,
    title: "Max wallet",
    description: "caps each wallet as a % of total supply",
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
    id: "dynamic-fees",
    number: 6,
    title: "Dynamic fees",
    description: "swap fee ramps with flow via the v4 dynamic fee flag",
    category: "trading-fees",
    icon: TrendingUp,
    theme: "ember",
    keyword: "FEE",
    creator: CREATOR,
    uses: 5,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,560",
    summary: "1 active hook block • DYNAMIC_FEE_FLAG 0x800000",
    settings: ["+ UNISWAP V4 DYNAMIC FEE FLAG", "+ FEE RAMPS WITH FLOW", "+ QUOTE-ONLY DEDUCTION"],
  },
  {
    id: "buyback-vesting",
    number: 7,
    title: "Buyback vesting",
    description: "creator proceeds vest linearly over a chosen duration",
    category: "tokenomics",
    icon: Hourglass,
    theme: "void",
    keyword: "VEST",
    creator: CREATOR,
    uses: 4,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,640",
    summary: "1 active hook block • creator-picked linear vest",
    settings: ["+ CREATOR CUT TO BUYBACKVAULT", "+ LINEAR VEST (7D–5Y)", "+ CLAIM AFTER UNLOCK"],
  },
  {
    id: "auto-burn",
    number: 8,
    title: "Auto-burn",
    description: "1% of actual token output sent directly to the dead address",
    category: "tokenomics",
    icon: Flame,
    theme: "crimson",
    keyword: "BURN",
    creator: CREATOR,
    uses: 4,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,680",
    summary: "1 active hook block • 1% output burn",
    settings: ["+ 1% OF TOKEN OUTPUT", "+ SENT TO DEAD ADDRESS", "+ BURN ON EVERY SWAP"],
  },
  {
    id: "lp-donate",
    number: 9,
    title: "LP donate",
    description: "0.25% of buys donated to in-range LPs",
    category: "rewards",
    icon: Coins,
    theme: "nature",
    keyword: "LP",
    creator: CREATOR,
    uses: 6,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,801",
    summary: "1 active hook block • 0.25% LP share",
    settings: ["+ 0.25% OF BUYS", "+ DONATED TO IN-RANGE LPS", "+ RANGE CHECK ENFORCED"],
  },
  {
    id: "holder-airdrop",
    number: 10,
    title: "Holder airdrop",
    description: "quote fees accrue; a swap pushes pro-rata to holders every 15 minutes",
    category: "rewards",
    icon: Gift,
    theme: "gold",
    keyword: "AIRDROP",
    creator: CREATOR,
    uses: 0,
    royalty: "0% of hook fees",
    savedAt: "Block —",
    summary: "quote fee share • 15m epoch airdrop",
    settings: [
      "+ ROUTE QUOTE FEES TO VAULT",
      "+ AIRDROP ON SWAP AFTER 15M",
      "+ PRO-RATA BY TOKEN BALANCE",
    ],
  },
  {
    id: "creator-share-to-hook",
    number: 11,
    title: "Creator → hook",
    description: "send your 70% of the base 1% into the hook pot instead of claiming escrow",
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
      "+ YOUR 70% JOINS HOOK POT",
      "+ SAME MODULE SPLIT AS HOOK TAX",
    ],
  },
];

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
      lpDonate?: boolean;
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
    "lp-donate": 0,
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
    if (pool.hooks.lpDonate) counts["lp-donate"] += 1;
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
  "lp-donate": "lpDonate",
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
  "lp-donate": "lpDonate",
  "holder-airdrop": "holderAirdrop",
  "creator-share-to-hook": "creatorShareToHook",
};

export function isMasterHookId(value: string | null): value is MasterHookId {
  return !!value && value in HOOK_MODULE_FIELD;
}

export function launchWithHookHref(id: MasterHookId) {
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
  if (!isMasterHookId(hookId)) return state;
  const field = HOOK_MODULE_FIELD[hookId];
  return {
    ...state,
    hookMode: "master",
    modules: { ...state.modules, [field]: true },
  };
}
