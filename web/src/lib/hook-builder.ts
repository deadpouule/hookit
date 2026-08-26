import {
  Gift,
  Percent,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { BASE_FEE_BPS } from "@/lib/constants";
import { HOOK_MODULE_ACCENTS, type HookModuleAccent } from "@/lib/hook-modules";
import type { LaunchModules } from "@/lib/types";

export const BUILDER_DRAFT_KEY = "hookit.builder.v1";

export type LiveBlockId =
  | "antiMev"
  | "maxTx"
  | "antiSnipe"
  | "creatorTax"
  | "backedFloor"
  | "autoBurn"
  | "lpDonate"
  | "maxWallet";

export type SoonBlockId = "surgeFees" | "nthBuy" | "royalty";

export type BuilderBlockId = LiveBlockId | SoonBlockId;

export type BuilderDraft = {
  modules: LaunchModules;
  creatorTaxBps: number;
};

export const EMPTY_BUILDER_MODULES: LaunchModules = {
  antiSnipe: false,
  antiSnipeDuration: 5,
  antiSnipeInitialTax: 98,
  backedFloor: false,
  floorAllocation: 10,
  antiMev: false,
  maxWallet: false,
  maxWalletBps: 200,
  maxTx: false,
  maxTxBps: 100,
  autoBurn: false,
  autoBurnPct: 20,
  lpDonate: false,
  lpDonatePct: 20,
};

export const EMPTY_BUILDER_DRAFT: BuilderDraft = {
  modules: EMPTY_BUILDER_MODULES,
  creatorTaxBps: 0,
};

/** Fixed hook execution order. UI stacking is cosmetic; MasterLaunchHook always runs this sequence. */
export const EXECUTION_ORDER: LiveBlockId[] = [
  "antiMev",
  "maxTx",
  "antiSnipe",
  "creatorTax",
  "backedFloor",
  "autoBurn",
  "lpDonate",
  "maxWallet",
];

export type BuilderBlockDef = {
  id: BuilderBlockId;
  live: boolean;
  label: string;
  short: string;
  description: string;
  accent: HookModuleAccent;
  icon?: LucideIcon;
};

const SOON_ACCENT = (id: string, label: string, color: string, icon: LucideIcon): HookModuleAccent => ({
  id,
  label,
  color,
  glow: `${color}88`,
  bg: "bg-white/[0.03]",
  border: "border-white/10",
  text: "text-zinc-500",
  icon,
});

export const LIVE_BLOCKS: BuilderBlockDef[] = [
  {
    id: "antiSnipe",
    live: true,
    label: "Anti-Snipe",
    short: "guards the open",
    description: "Decaying buy tax for the first N seconds after launch.",
    accent: HOOK_MODULE_ACCENTS.antiSnipe,
  },
  {
    id: "backedFloor",
    live: true,
    label: "Backed Floor",
    short: "ratchets support",
    description: "Routes a cut of quote fees into a vault that fills sells at the floor.",
    accent: HOOK_MODULE_ACCENTS.backedFloor,
  },
  {
    id: "autoBurn",
    live: true,
    label: "Auto Burn",
    short: "buyback + burn",
    description: "A cut of quote fees buys the token from the pool and burns it.",
    accent: HOOK_MODULE_ACCENTS.autoBurn,
  },
  {
    id: "lpDonate",
    live: true,
    label: "LP Donate",
    short: "feeds in-range LPs",
    description: "A cut of quote fees is donated to in-range liquidity via Uniswap v4 donate.",
    accent: HOOK_MODULE_ACCENTS.lpDonate,
  },
  {
    id: "antiMev",
    live: true,
    label: "Anti-MEV",
    short: "same-block lock",
    description: "Blocks an opposite swap from the same origin in the same block.",
    accent: HOOK_MODULE_ACCENTS.antiMev,
  },
  {
    id: "maxWallet",
    live: true,
    label: "Max Wallet",
    short: "holding cap",
    description: "Reverts if the recipient would hold more than a % of supply.",
    accent: HOOK_MODULE_ACCENTS.maxWallet,
  },
  {
    id: "maxTx",
    live: true,
    label: "Max TX",
    short: "size cap",
    description: "Caps each swap against a % of total supply.",
    accent: HOOK_MODULE_ACCENTS.maxTx,
  },
  {
    id: "creatorTax",
    live: true,
    label: "Creator Tax",
    short: "extra quote cut",
    description: "Extra quote-only fee, 100% to the launching wallet via escrow.",
    accent: HOOK_MODULE_ACCENTS.creatorTax,
  },
];

export const SOON_BLOCKS: BuilderBlockDef[] = [
  {
    id: "surgeFees",
    live: false,
    label: "Surge Fees",
    short: "scales with size",
    description: "Fee that grows with trade size. Not in MasterLaunchHook yet.",
    accent: SOON_ACCENT("surge", "Surge Fees", "#ff8a4c", Sparkles),
    icon: Sparkles,
  },
  {
    id: "nthBuy",
    live: false,
    label: "Nth-buy Pot",
    short: "pays every Nth",
    description: "Public counter pot. Needs a dedicated escrow, not a bitmask flag.",
    accent: SOON_ACCENT("nth", "Nth-buy Pot", "#f5d76e", Gift),
    icon: Gift,
  },
  {
    id: "royalty",
    live: false,
    label: "Hook Royalty",
    short: "author share",
    description: "Marketplace author cut. Requires hookAuthor in prepareLaunch.",
    accent: SOON_ACCENT("royalty", "Hook Royalty", "#c4b5fd", Percent),
    icon: Percent,
  },
];

export const ALL_LIVE_BY_ID = Object.fromEntries(LIVE_BLOCKS.map((b) => [b.id, b])) as Record<
  LiveBlockId,
  BuilderBlockDef
>;

export function isBlockEnabled(
  id: LiveBlockId,
  modules: LaunchModules,
  creatorTaxBps: number,
): boolean {
  switch (id) {
    case "creatorTax":
      return creatorTaxBps > 0;
    case "antiMev":
      return modules.antiMev;
    case "maxTx":
      return modules.maxTx;
    case "antiSnipe":
      return modules.antiSnipe;
    case "backedFloor":
      return modules.backedFloor;
    case "autoBurn":
      return modules.autoBurn;
    case "lpDonate":
      return modules.lpDonate;
    case "maxWallet":
      return modules.maxWallet;
  }
}

/** Share of the quote-fee pool routed to floor + auto-burn + LP donate (max 100). */
export function feeRoutePct(modules: LaunchModules): number {
  let routed = 0;
  if (modules.backedFloor) routed += modules.floorAllocation;
  if (modules.autoBurn) routed += modules.autoBurnPct;
  if (modules.lpDonate) routed += modules.lpDonatePct;
  return routed;
}

export function enabledLiveBlocks(
  modules: LaunchModules,
  creatorTaxBps: number,
): LiveBlockId[] {
  return EXECUTION_ORDER.filter((id) => isBlockEnabled(id, modules, creatorTaxBps));
}

export function buyOverheadBps(modules: LaunchModules, creatorTaxBps: number): {
  atOpen: number;
  steady: number;
} {
  const steady = BASE_FEE_BPS + creatorTaxBps;
  const snipe = modules.antiSnipe ? modules.antiSnipeInitialTax * 100 : 0;
  return { atOpen: steady + snipe, steady };
}

export function formatOverhead(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

/** Rough client-side gas from MasterLaunchHook snapshots, not a simulation. */
export function estimateBuyGas(modules: LaunchModules, creatorTaxBps: number): number {
  const n = enabledLiveBlocks(modules, creatorTaxBps).length;
  return 1_850_000 + n * 40_000;
}

export function formatGas(gas: number): string {
  if (gas >= 1_000_000) return `${(gas / 1_000_000).toFixed(2)}M`;
  return `${Math.round(gas / 1000)}K`;
}

export function saveBuilderDraft(draft: BuilderDraft): void {
  sessionStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(draft));
}

export function loadBuilderDraft(): BuilderDraft | null {
  try {
    const raw = sessionStorage.getItem(BUILDER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderDraft>;
    if (!parsed.modules || typeof parsed.creatorTaxBps !== "number") return null;
    return {
      modules: { ...EMPTY_BUILDER_MODULES, ...parsed.modules },
      creatorTaxBps: parsed.creatorTaxBps,
    };
  } catch {
    return null;
  }
}

export function applyBlockToggle(
  id: LiveBlockId,
  enabled: boolean,
  draft: BuilderDraft,
): BuilderDraft {
  if (id === "creatorTax") {
    return { ...draft, creatorTaxBps: enabled ? Math.max(draft.creatorTaxBps, 50) : 0 };
  }
  return { ...draft, modules: { ...draft.modules, [id]: enabled } };
}
