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
  | "hookTax"
  | "backedFloor"
  | "autoBurn"
  | "lpDonate"
  | "holderAirdrop"
  | "creatorShareToHook"
  | "maxWallet";

export type SoonBlockId = "surgeFees" | "nthBuy" | "royalty";

export type BuilderBlockId = LiveBlockId | SoonBlockId;

export type BuilderDraft = {
  modules: LaunchModules;
  hookTaxBps: number;
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
  holderAirdrop: false,
  holderAirdropPct: 50,
  creatorShareToHook: false,
};

export const EMPTY_BUILDER_DRAFT: BuilderDraft = {
  modules: EMPTY_BUILDER_MODULES,
  hookTaxBps: 0,
};

/** Fixed hook execution order. UI stacking is cosmetic; MasterLaunchHook always runs this sequence. */
export const EXECUTION_ORDER: LiveBlockId[] = [
  "antiMev",
  "maxTx",
  "antiSnipe",
  "hookTax",
  "backedFloor",
  "autoBurn",
  "lpDonate",
  "holderAirdrop",
  "creatorShareToHook",
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
    id: "holderAirdrop",
    live: true,
    label: "Holder Airdrop",
    short: "15m quote push",
    description:
      "A cut of the hook pot accrues; once the 15m window is open, a swap on the token pushes pro-rata quote to holders.",
    accent: HOOK_MODULE_ACCENTS.holderAirdrop,
  },
  {
    id: "creatorShareToHook",
    live: true,
    label: "Creator → Hook",
    short: "70% into modules",
    description:
      "Send the creator’s 70% of the base 1% fee into the hook pot (floor / burn / donate / airdrop) instead of escrow.",
    accent: HOOK_MODULE_ACCENTS.hookTax,
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
    id: "hookTax",
    live: true,
    label: "Hook Tax",
    short: "extra quote cut",
    description: "Extra quote fee for Master modules (floor, burn, donate, airdrop) — not paid to the creator.",
    accent: HOOK_MODULE_ACCENTS.hookTax,
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
  hookTaxBps: number,
): boolean {
  switch (id) {
    case "hookTax":
      return hookTaxBps > 0;
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
    case "holderAirdrop":
      return modules.holderAirdrop;
    case "creatorShareToHook":
      return modules.creatorShareToHook;
    case "maxWallet":
      return modules.maxWallet;
  }
}

/** Share of the quote-fee pool routed to floor + auto-burn + LP donate + holder airdrop (max 100). */
export function feeRoutePct(modules: LaunchModules): number {
  let routed = 0;
  if (modules.backedFloor) routed += modules.floorAllocation;
  if (modules.autoBurn) routed += modules.autoBurnPct;
  if (modules.lpDonate) routed += modules.lpDonatePct;
  if (modules.holderAirdrop) routed += modules.holderAirdropPct;
  return routed;
}

export function enabledLiveBlocks(
  modules: LaunchModules,
  hookTaxBps: number,
): LiveBlockId[] {
  return EXECUTION_ORDER.filter((id) => isBlockEnabled(id, modules, hookTaxBps));
}

export function buyOverheadBps(modules: LaunchModules, hookTaxBps: number): {
  atOpen: number;
  steady: number;
} {
  const steady = BASE_FEE_BPS + hookTaxBps;
  const snipe = modules.antiSnipe ? modules.antiSnipeInitialTax * 100 : 0;
  return { atOpen: steady + snipe, steady };
}

export function formatOverhead(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

/** Rough client-side gas from MasterLaunchHook snapshots, not a simulation. */
export function estimateBuyGas(modules: LaunchModules, hookTaxBps: number): number {
  const n = enabledLiveBlocks(modules, hookTaxBps).length;
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
    if (!parsed.modules || typeof parsed.hookTaxBps !== "number") return null;
    return {
      modules: { ...EMPTY_BUILDER_MODULES, ...parsed.modules },
      hookTaxBps: parsed.hookTaxBps,
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
  if (id === "hookTax") {
    return { ...draft, hookTaxBps: enabled ? Math.max(draft.hookTaxBps, 50) : 0 };
  }
  if (id === "creatorShareToHook") {
    return {
      ...draft,
      modules: {
        ...draft.modules,
        creatorShareToHook: enabled,
        buybackVesting: enabled ? false : draft.modules.buybackVesting,
      },
    };
  }
  const nextModules = { ...draft.modules, [id]: enabled };
  let { hookTaxBps } = draft;
  const feeSink =
    id === "backedFloor" || id === "autoBurn" || id === "lpDonate" || id === "holderAirdrop";
  if (enabled && feeSink && hookTaxBps === 0 && !nextModules.creatorShareToHook) hookTaxBps = 50;
  return { ...draft, modules: nextModules, hookTaxBps };
}
