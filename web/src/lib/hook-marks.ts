import type { HookTheme, MasterHookId } from "@/lib/master-hooks";

export type HookId =
  | "antiSnipe"
  | "backedFloor"
  | "antiMev"
  | "maxWallet"
  | "maxTx"
  | "holderAirdrop"
  | "dynamicFees"
  | "buybackVesting"
  | "autoBurn"
  | "lpDonate"
  | "creatorShareToHook"
  | "custom"
  | "quoteFee";

export interface HookMarkDef {
  id: HookId;
  label: string;
  short: string;
  hint: string;
  color: string;
  glow: string;
}

export const HOOK_MARKS: Record<HookId, HookMarkDef> = {
  antiSnipe: {
    id: "antiSnipe",
    label: "Anti-Snipe",
    short: "Snipe",
    hint: "Decay tax on opening buys",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.45)",
  },
  backedFloor: {
    id: "backedFloor",
    label: "Backed Floor",
    short: "Floor",
    hint: "Ratcheting vault floor",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.4)",
  },
  antiMev: {
    id: "antiMev",
    label: "Anti-MEV",
    short: "MEV",
    hint: "Same-block cooldown",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.45)",
  },
  maxWallet: {
    id: "maxWallet",
    label: "Max Wallet",
    short: "Wallet",
    hint: "Per-wallet supply cap",
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.4)",
  },
  maxTx: {
    id: "maxTx",
    label: "Max Tx",
    short: "Tx",
    hint: "Per-swap supply cap",
    color: "#03b1ed",
    glow: "rgba(3,177,237,0.4)",
  },
  holderAirdrop: {
    id: "holderAirdrop",
    label: "Holder Airdrop",
    short: "Airdrop",
    hint: "Quote fees push to holders every 15m",
    color: "#f5d76e",
    glow: "rgba(245,215,110,0.45)",
  },
  dynamicFees: {
    id: "dynamicFees",
    label: "Dynamic fees",
    short: "Dyn fees",
    hint: "Volatility-adjusted LP fee flag",
    color: "#f97316",
    glow: "rgba(249,115,22,0.4)",
  },
  buybackVesting: {
    id: "buybackVesting",
    label: "Buyback vesting",
    short: "Vest",
    hint: "Creator proceeds vest linearly",
    color: "#e879f9",
    glow: "rgba(232,121,249,0.4)",
  },
  autoBurn: {
    id: "autoBurn",
    label: "Auto-burn",
    short: "Burn",
    hint: "Share of fees burned",
    color: "#dc2626",
    glow: "rgba(220,38,38,0.45)",
  },
  lpDonate: {
    id: "lpDonate",
    label: "LP donate",
    short: "LP",
    hint: "Share of fees to in-range LPs",
    color: "#10b981",
    glow: "rgba(16,185,129,0.4)",
  },
  creatorShareToHook: {
    id: "creatorShareToHook",
    label: "Creator → hook",
    short: "→ hook",
    hint: "Creator base share funds hook modules",
    color: "#84cc16",
    glow: "rgba(132,204,22,0.4)",
  },
  custom: {
    id: "custom",
    label: "Custom Solidity",
    short: "Custom",
    hint: "Your own v4 hook",
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.45)",
  },
  quoteFee: {
    id: "quoteFee",
    label: "Quote-only fees",
    short: "Fees",
    hint: "Fees taken in ETH",
    color: "#34d399",
    glow: "rgba(52,211,153,0.4)",
  },
};

export const MASTER_HOOK_IDS: HookId[] = [
  "antiSnipe",
  "backedFloor",
  "antiMev",
  "maxWallet",
  "maxTx",
  "holderAirdrop",
  "dynamicFees",
  "buybackVesting",
  "autoBurn",
  "lpDonate",
];

export const SHOWCASE_HOOK_IDS: HookId[] = [
  "antiSnipe",
  "backedFloor",
  "antiMev",
  "holderAirdrop",
  "custom",
  "quoteFee",
];

/** Maps launch-summary / pool hook marks to master hook modules (for ASCII + theme). */
export const HOOK_MARK_TO_MASTER: Partial<Record<HookId, MasterHookId>> = {
  antiSnipe: "anti-snipe",
  backedFloor: "backed-floor",
  antiMev: "anti-mev",
  maxWallet: "max-wallet",
  maxTx: "max-tx",
  holderAirdrop: "holder-airdrop",
  dynamicFees: "dynamic-fees",
  buybackVesting: "buyback-vesting",
  autoBurn: "auto-burn",
  lpDonate: "lp-donate",
  creatorShareToHook: "creator-share-to-hook",
  quoteFee: "dynamic-fees",
};

/** Reverse of HOOK_MARK_TO_MASTER for enabled-module → summary chips. */
export const MASTER_TO_HOOK_MARK: Record<MasterHookId, HookId> = {
  "anti-snipe": "antiSnipe",
  "backed-floor": "backedFloor",
  "anti-mev": "antiMev",
  "max-wallet": "maxWallet",
  "max-tx": "maxTx",
  "holder-airdrop": "holderAirdrop",
  "dynamic-fees": "dynamicFees",
  "buyback-vesting": "buybackVesting",
  "auto-burn": "autoBurn",
  "lp-donate": "lpDonate",
  "creator-share-to-hook": "creatorShareToHook",
};

/** Badge theme overrides when the mark is not a 1:1 master hook title. */
export const HOOK_MARK_THEME: Partial<Record<HookId, HookTheme>> = {
  quoteFee: "nature",
  custom: "gold",
};
