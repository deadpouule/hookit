import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Coins,
  Percent,
  Shield,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type HookModuleAccent = {
  id: string;
  label: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
};

/** Vibrant degen palette — each module pops on ink black */
export const HOOK_MODULE_ACCENTS = {
  antiSnipe: {
    id: "anti-snipe",
    label: "Anti-Snipe",
    color: "#ffb020",
    glow: "rgba(255, 176, 32, 0.55)",
    bg: "bg-[#ffb020]/12",
    border: "border-[#ffb020]/40",
    text: "text-[#ffc857]",
    icon: ShieldAlert,
  },
  backedFloor: {
    id: "backed-floor",
    label: "Backed Floor",
    color: "#39ff8a",
    glow: "rgba(57, 255, 138, 0.5)",
    bg: "bg-[#39ff8a]/10",
    border: "border-[#39ff8a]/40",
    text: "text-[#6bffb0]",
    icon: TrendingUp,
  },
  antiMev: {
    id: "anti-mev",
    label: "Anti-MEV",
    color: "#c77dff",
    glow: "rgba(199, 125, 255, 0.55)",
    bg: "bg-[#c77dff]/12",
    border: "border-[#c77dff]/40",
    text: "text-[#ddb3ff]",
    icon: Shield,
  },
  maxWallet: {
    id: "max-wallet",
    label: "Max Wallet",
    color: "#4cc9ff",
    glow: "rgba(76, 201, 255, 0.5)",
    bg: "bg-[#4cc9ff]/10",
    border: "border-[#4cc9ff]/40",
    text: "text-[#7dd8ff]",
    icon: Wallet,
  },
  maxTx: {
    id: "max-tx",
    label: "Max TX",
    color: "#ff5ca8",
    glow: "rgba(255, 92, 168, 0.55)",
    bg: "bg-[#ff5ca8]/10",
    border: "border-[#ff5ca8]/40",
    text: "text-[#ff8cc4]",
    icon: ArrowLeftRight,
  },
  creatorTax: {
    id: "creator-tax",
    label: "Creator Tax",
    color: "#ff2bd6",
    glow: "rgba(255, 43, 214, 0.6)",
    bg: "bg-[#ff2bd6]/12",
    border: "border-[#ff2bd6]/45",
    text: "text-[#ff6de8]",
    icon: Percent,
  },
  swapFee: {
    id: "swap-fee",
    label: "Swap Fee",
    color: "#b87aff",
    glow: "rgba(184, 122, 255, 0.5)",
    bg: "bg-[#b87aff]/12",
    border: "border-[#b87aff]/40",
    text: "text-[#d4b3ff]",
    icon: Coins,
  },
} as const satisfies Record<string, HookModuleAccent>;

const TAG_TO_ACCENT: Record<string, HookModuleAccent> = {
  "Anti-Snipe": HOOK_MODULE_ACCENTS.antiSnipe,
  "Backed Floor": HOOK_MODULE_ACCENTS.backedFloor,
  "Anti-MEV": HOOK_MODULE_ACCENTS.antiMev,
  "Max Wallet": HOOK_MODULE_ACCENTS.maxWallet,
  "Max TX": HOOK_MODULE_ACCENTS.maxTx,
  "Custom Hook": {
    ...HOOK_MODULE_ACCENTS.creatorTax,
    id: "custom",
    label: "Custom",
  },
  "Auto-deploy": HOOK_MODULE_ACCENTS.swapFee,
};

export function accentForTag(tag: string): HookModuleAccent {
  return TAG_TO_ACCENT[tag] ?? HOOK_MODULE_ACCENTS.swapFee;
}
