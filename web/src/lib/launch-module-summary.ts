import { CREATOR_SHARE_BPS } from "@/lib/constants";
import { unpackLaunchBitmask } from "@/lib/bitmask";
import { HOOK_MARK_TO_MASTER, HOOK_MARKS, type HookId } from "@/lib/hook-marks";
import { HOOK_MODULE_FIELD, MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import type { LaunchModules, TokenPool } from "@/lib/types";

export type ModuleSummaryLine = {
  id: MasterHookId | "creator-share-to-hook";
  title: string;
  detail: string;
};

export function resolveTokenModules(
  pool: Pick<TokenPool, "modules" | "bitmask" | "hookTaxBps" | "rail" | "hookType" | "hooks">,
): { modules: LaunchModules; hookTaxBps: number } | null {
  if (pool.modules) {
    return { modules: pool.modules, hookTaxBps: pool.hookTaxBps ?? 0 };
  }
  if (pool.bitmask) {
    try {
      const { modules, hookTaxBps } = unpackLaunchBitmask(BigInt(pool.bitmask));
      return { modules, hookTaxBps };
    } catch {
      return null;
    }
  }
  return null;
}

export function isModuleEnabled(modules: LaunchModules, id: MasterHookId): boolean {
  return Boolean(modules[HOOK_MODULE_FIELD[id]]);
}

export function moduleDetailLine(
  id: MasterHookId,
  modules: LaunchModules,
  hookTaxBps = 0,
): string {
  switch (id) {
    case "anti-snipe":
      return `${modules.antiSnipeInitialTax}% snipe tax · ${modules.antiSnipeDuration}s window`;
    case "backed-floor":
      return `${modules.floorAllocation}% of hook fees → floor vault`;
    case "anti-mev":
      return "Blocks same-block bot trades";
    case "max-tx":
      return `Max ${(modules.maxTxBps / 100).toFixed(1)}% of supply per swap`;
    case "max-wallet":
      return `Max ${(modules.maxWalletBps / 100).toFixed(1)}% of supply per wallet`;
    case "dynamic-fees":
      return "Swap fee adapts to volume";
    case "buyback-vesting": {
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      return days >= 365
        ? `Creator fees unlock over ${Math.round(days / 365)} years`
        : `Creator fees unlock over ${days} days`;
    }
    case "auto-burn":
      return `${modules.autoBurnPct}% of hook fees burned`;
    case "lp-donate":
      return `${modules.lpDonatePct}% of hook fees → LPs`;
    case "holder-airdrop":
      return `${modules.holderAirdropPct}% of hook fees → holder drops`;
    case "creator-share-to-hook": {
      const share = CREATOR_SHARE_BPS / 100;
      if (hookTaxBps > 0) {
        return `${share}% creator fees → hooks · ${(hookTaxBps / 100).toFixed(1)}% hook tax`;
      }
      return `${share}% creator fees routed to hook pot`;
    }
    default:
      return "Enabled";
  }
}

/** Token page tooltip: brief hook explanation + this token's saved config. */
export function moduleTooltipText(
  description: string,
  id: MasterHookId,
  modules: LaunchModules,
  hookTaxBps = 0,
): string {
  const lead = description.charAt(0).toUpperCase() + description.slice(1);
  const config = moduleDetailLine(id, modules, hookTaxBps);
  return `${lead} · ${config}`;
}

export function hookMarkTooltipText(
  id: HookId,
  modules?: LaunchModules,
  hookTaxBps = 0,
): string {
  const masterId = HOOK_MARK_TO_MASTER[id];
  if (masterId && modules) return moduleDetailLine(masterId, modules, hookTaxBps);
  return HOOK_MARKS[id]?.hint ?? "Enabled";
}

/** Short hint shown on module cards when toggled on. */
export function moduleCardHint(id: MasterHookId, modules: LaunchModules, hookTaxBps = 0): string {
  if (!isModuleEnabled(modules, id)) return "";
  const detail = moduleDetailLine(id, modules, hookTaxBps);
  return detail.length > 42 ? `${detail.slice(0, 40)}…` : detail;
}

export function listEnabledModuleSummaries(
  modules: LaunchModules,
  opts?: { hookTaxBps?: number },
): ModuleSummaryLine[] {
  const hookTaxBps = opts?.hookTaxBps ?? 0;
  return MASTER_HOOKS.filter((h) => isModuleEnabled(modules, h.id)).map((h) => ({
    id: h.id,
    title: h.title,
    detail: moduleDetailLine(h.id, modules, hookTaxBps),
  }));
}

export function hookTaxSummary(hookTaxBps: number): string {
  if (hookTaxBps <= 0) return "0% (modules only if creator → hook)";
  return `${(hookTaxBps / 100).toFixed(1)}% on swaps`;
}

export function totalFeeSummary(hookTaxBps: number): string {
  const total = 100 + hookTaxBps;
  return `${(total / 100).toFixed(1)}% max steady (1% base + fees)`;
}

export function totalFeePlain(hookTaxBps: number): string {
  const total = 100 + hookTaxBps;
  return `Up to ${(total / 100).toFixed(1)}% per swap`;
}

export function totalFeeTooltip(hookTaxBps: number): string {
  if (hookTaxBps <= 0) {
    return "1% base swap fee. Extra module fees only apply if the creator sends their share into hooks.";
  }
  return `1% base fee + ${(hookTaxBps / 100).toFixed(1)}% hook fee on swaps.`;
}

const MODULE_SUMMARY_PHRASE: Record<MasterHookId, string> = {
  "anti-snipe": "Blocks snipers at launch",
  "backed-floor": "Quote-backed price floor",
  "anti-mev": "Blocks same-block bot trades",
  "max-tx": "Caps swap size vs supply",
  "max-wallet": "Caps wallet holdings",
  "dynamic-fees": "Fees rise with volume",
  "buyback-vesting": "Creator fees vest over time",
  "auto-burn": "Burns tokens on swaps",
  "lp-donate": "Rewards in-range LPs",
  "holder-airdrop": "Drops quote to holders",
  "creator-share-to-hook": "Creator fees → hook pot",
};

/** Short one-liner for pick cards and config badges. */
export function hookPickTip(id: MasterHookId): string {
  return MODULE_SUMMARY_PHRASE[id];
}

const HOOK_PICK_TAGLINE: Record<MasterHookId, string> = {
  "anti-snipe": "Launch sniper tax",
  "backed-floor": "Quote price floor",
  "anti-mev": "Block bot trades",
  "max-tx": "Cap swap size",
  "max-wallet": "Cap wallet size",
  "dynamic-fees": "Volume-based fees",
  "buyback-vesting": "Creator fee vest",
  "auto-burn": "Burn on swap",
  "lp-donate": "Reward LPs",
  "holder-airdrop": "Holder airdrops",
  "creator-share-to-hook": "Fees → hook pot",
};

/** 2–3 word label under pick cards. */
export function hookPickTagline(id: MasterHookId): string {
  return HOOK_PICK_TAGLINE[id];
}

const HOOK_PICK_DETAIL: Record<MasterHookId, string> = {
  "anti-snipe":
    "Adds a decaying tax on early buys during your launch window. Snipers pay the highest rate at open; the tax steps down over the duration you choose until it matches your base swap fee.",
  "backed-floor":
    "Skims a share of hook fees into a FloorVault backed by the quote asset. The floor price ratchets up with each deposit and never decreases — holders can redeem tokens against the vault.",
  "anti-mev":
    "Blocks buy-then-sell (and sell-then-buy) in the same block from the same wallet. Uses a per-origin cooldown so sandwich bots and same-block flippers get reverted.",
  "max-tx":
    "Limits how large any single swap can be relative to total supply. Oversized exact-input swaps revert — useful against whale dumps or bot-sized trades.",
  "max-wallet":
    "Caps how much of the supply any one wallet can hold after a buy. Checked post-transfer so no wallet can accumulate beyond your chosen percentage.",
  "dynamic-fees":
    "Enables Uniswap v4 dynamic fees on the pool. Swap fee ramps with recent flow so quiet periods stay cheap and heavy volume pays more — all deducted in quote only.",
  "buyback-vesting":
    "Routes the creator's 70% base-fee share into a vesting vault instead of instant escrow. Proceeds unlock linearly over the duration you pick and are claimable on the token page.",
  "auto-burn":
    "Sends a slice of the hook fee pot to the dead address on every swap. Supply shrinks over time without manual burns or sell pressure on your token.",
  "lp-donate":
    "Donates a share of hook fees to liquidity providers who are in-range at swap time. Rewards active LPs and keeps depth where it matters.",
  "holder-airdrop":
    "Accrues quote fees in a vault and pushes pro-rata drops to token holders on swap after each 15-minute epoch. Permissionless — anyone can trigger the push.",
  "creator-share-to-hook":
    "Redirects your 70% creator cut from escrow into the same hook pot as module fees. Split across floor, burn, LP donate, airdrop, or protocol based on what you enabled.",
};

/** Longer copy for pick-card and config tooltips. */
export function hookPickDetail(id: MasterHookId): string {
  return HOOK_PICK_DETAIL[id];
}

const MODULE_SUMMARY_PHRASE_LOWER: Record<MasterHookId, string> = {
  "anti-snipe": "blocks snipers at launch",
  "backed-floor": "has a price floor",
  "anti-mev": "blocks bot trades",
  "max-tx": "limits trade size",
  "max-wallet": "limits wallet size",
  "dynamic-fees": "adjusts fees with activity",
  "buyback-vesting": "locks creator fees over time",
  "auto-burn": "burns tokens on swaps",
  "lp-donate": "rewards liquidity providers",
  "holder-airdrop": "airdrops to holders",
  "creator-share-to-hook": "feeds creator fees into hooks",
};

export function buildModulesSummarySentence(hookIds: MasterHookId[]): string {
  const phrases = hookIds.map((id) => MODULE_SUMMARY_PHRASE_LOWER[id]).filter(Boolean);
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return `This token ${phrases[0]}.`;
  const last = phrases[phrases.length - 1];
  const rest = phrases.slice(0, -1);
  return `This token ${rest.join(", ")} and ${last}.`;
}

export function hookMarkSummaryDetail(id: HookId, modules: LaunchModules, hookTaxBps = 0): string {
  if (id === "quoteFee") return "1% base · quote-only on swaps";
  if (id === "custom") return HOOK_MARKS.custom.hint;

  const masterId = HOOK_MARK_TO_MASTER[id];
  if (masterId) return moduleDetailLine(masterId, modules, hookTaxBps);

  return HOOK_MARKS[id]?.hint ?? "Enabled";
}
