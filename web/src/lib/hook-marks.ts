export type HookId =
  | "antiSnipe"
  | "backedFloor"
  | "antiMev"
  | "maxWallet"
  | "maxTx"
  | "holderAirdrop"
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
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.45)",
  },
  backedFloor: {
    id: "backedFloor",
    label: "Backed Floor",
    short: "Floor",
    hint: "Ratcheting vault floor",
    color: "#d4ff00",
    glow: "rgba(212,255,0,0.4)",
  },
  antiMev: {
    id: "antiMev",
    label: "Anti-MEV",
    short: "MEV",
    hint: "Same-block cooldown",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.45)",
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
    color: "#fb923c",
    glow: "rgba(251,146,60,0.4)",
  },
  holderAirdrop: {
    id: "holderAirdrop",
    label: "Holder Airdrop",
    short: "Airdrop",
    hint: "Quote fees push to holders every 15m",
    color: "#f5d76e",
    glow: "rgba(245,215,110,0.45)",
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
];

export const SHOWCASE_HOOK_IDS: HookId[] = [
  "antiSnipe",
  "backedFloor",
  "antiMev",
  "holderAirdrop",
  "custom",
  "quoteFee",
];
