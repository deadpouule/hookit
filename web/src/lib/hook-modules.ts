import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Coins,
  Droplets,
  Flame,
  Gift,
  Percent,
  Shield,
  ShieldAlert,
  TrendingUp,
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

/** Vibrant degen palette - each module pops on ink black */
export const HOOK_MODULE_ACCENTS = {
  antiSnipe: {
    id: "anti-snipe",
    label: "Anti-Snipe",
    color: "#ff0050",
    glow: "rgba(255, 0, 80, 0.55)",
    bg: "bg-[#ff0050]/12",
    border: "border-[#ff0050]/40",
    text: "text-[#ff7aa0]",
    icon: ShieldAlert,
  },
  backedFloor: {
    id: "backed-floor",
    label: "Backed Floor",
    color: "#4e561a",
    glow: "rgba(78, 86, 26, 0.5)",
    bg: "bg-[#4e561a]/15",
    border: "border-[#4e561a]/45",
    text: "text-[#c4cc7a]",
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
  maxTx: {
    id: "max-tx",
    label: "Max Tx",
    color: "#84cc16",
    glow: "rgba(132, 204, 22, 0.5)",
    bg: "bg-[#84cc16]/10",
    border: "border-[#84cc16]/40",
    text: "text-[#d9f99d]",
    icon: ArrowLeftRight,
  },
  hookTax: {
    id: "hook-tax",
    label: "Hook Tax",
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
  autoBurn: {
    id: "auto-burn",
    label: "Auto-Burn",
    color: "#ff5c5c",
    glow: "rgba(255, 92, 92, 0.55)",
    bg: "bg-[#ff5c5c]/12",
    border: "border-[#ff5c5c]/40",
    text: "text-[#ff8a8a]",
    icon: Flame,
  },
  deepenLps: {
    id: "deepen-lps",
    label: "Deepen LPs",
    color: "#6ee7b7",
    glow: "rgba(110, 231, 183, 0.5)",
    bg: "bg-[#6ee7b7]/10",
    border: "border-[#6ee7b7]/40",
    text: "text-[#9ff5d0]",
    icon: Droplets,
  },
  holderAirdrop: {
    id: "holder-airdrop",
    label: "Holder Airdrop",
    color: "#f5d76e",
    glow: "rgba(245, 215, 110, 0.55)",
    bg: "bg-[#f5d76e]/12",
    border: "border-[#f5d76e]/40",
    text: "text-[#ffe9a0]",
    icon: Gift,
  },
  hookToCreator: {
    id: "hook-to-creator",
    label: "Hook → Creator",
    color: "#dc2626",
    glow: "rgba(220, 38, 38, 0.5)",
    bg: "bg-[#dc2626]/12",
    border: "border-[#dc2626]/40",
    text: "text-[#fca5a5]",
    icon: ArrowDownToLine,
  },
} as const satisfies Record<string, HookModuleAccent>;

const TAG_TO_ACCENT: Record<string, HookModuleAccent> = {
  "Anti-Snipe": HOOK_MODULE_ACCENTS.antiSnipe,
  "Backed Floor": HOOK_MODULE_ACCENTS.backedFloor,
  "Anti-MEV": HOOK_MODULE_ACCENTS.antiMev,
  "Max Tx": HOOK_MODULE_ACCENTS.maxTx,
  "Max TX": HOOK_MODULE_ACCENTS.maxTx,
  "Hook Tax": HOOK_MODULE_ACCENTS.hookTax,
  "Auto-Burn": HOOK_MODULE_ACCENTS.autoBurn,
  "Auto Burn": HOOK_MODULE_ACCENTS.autoBurn,
  "Deepen LPs": HOOK_MODULE_ACCENTS.deepenLps,
  "Holder Airdrop": HOOK_MODULE_ACCENTS.holderAirdrop,
  "Hook → Creator": HOOK_MODULE_ACCENTS.hookToCreator,
  "Custom Hook": {
    ...HOOK_MODULE_ACCENTS.hookTax,
    id: "custom",
    label: "Custom",
  },
  "Auto-deploy": HOOK_MODULE_ACCENTS.swapFee,
};

export function accentForTag(tag: string): HookModuleAccent {
  return TAG_TO_ACCENT[tag] ?? HOOK_MODULE_ACCENTS.swapFee;
}
