import type { LucideIcon } from "lucide-react";
import {
  Coins,
  EyeOff,
  Flame,
  Gauge,
  Hourglass,
  Layers,
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
  | "lp-donate";

export type HookTheme = "fire" | "gold" | "void" | "nature" | "volt" | "ice" | "ember" | "rose" | "steel";

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
    description: "creator proceeds vest linearly over 5 years",
    category: "tokenomics",
    icon: Hourglass,
    theme: "rose",
    keyword: "VEST",
    creator: CREATOR,
    uses: 4,
    royalty: "0% of hook fees",
    savedAt: "Block 25,799,640",
    summary: "1 active hook block • 5-year linear vest",
    settings: ["+ CREATOR CUT TO BUYBACKVAULT", "+ LINEAR VEST 5 YEARS", "+ CLAIM AFTER UNLOCK"],
  },
  {
    id: "auto-burn",
    number: 8,
    title: "Auto-burn",
    description: "1% of actual token output sent directly to the dead address",
    category: "tokenomics",
    icon: Flame,
    theme: "void",
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
];

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const HOOK_MODULE_FIELD: Record<MasterHookId, keyof import("@/lib/types").LaunchModules> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-tx": "maxTx",
  "max-wallet": "maxWallet",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "lp-donate": "lpDonate",
};

export function isMasterHookId(value: string | null): value is MasterHookId {
  return !!value && value in HOOK_MODULE_FIELD;
}

export function launchWithHookHref(id: MasterHookId) {
  return `/launch/custom?hook=${id}`;
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
