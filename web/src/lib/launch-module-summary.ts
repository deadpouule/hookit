import { CREATOR_SHARE_BPS } from "@/lib/constants";
import { formatCompactUsd } from "@/lib/format";
import { formatDynamicFeeRange } from "@/lib/fee-range";
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
      return formatDynamicFeeRange(modules, hookTaxBps);
    case "buyback-vesting": {
      const mcapUsd = modules.buybackVestingMcapUsd ?? 0;
      if (mcapUsd > 0) {
        if (modules.buybackVestingUnlockMode === "steps") {
          return `Unlocks by % as FDV climbs (last rung ${formatCompactUsd(mcapUsd)})`;
        }
        return `Unlocks in full at ${formatCompactUsd(mcapUsd)} FDV`;
      }
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      return days >= 365
        ? `Creator fees unlock over ${Math.round(days / 365)} years`
        : `Creator fees unlock over ${days} days`;
    }
    case "auto-burn":
      return `${modules.autoBurnPct}% of hook fees burned`;
    case "deepen-lps":
      return `${modules.deepenLpsPct}% of hook fees → extra LP depth`;
    case "holder-airdrop": {
      const mcapUsd = modules.holderAirdropMcapUsd ?? 0;
      if (mcapUsd > 0) {
        if (modules.holderAirdropUnlockMode === "steps") {
          return `${modules.holderAirdropPct}% of hook fees → holders, by % to ${formatCompactUsd(mcapUsd)}`;
        }
        return `${modules.holderAirdropPct}% of hook fees → holders until ${formatCompactUsd(mcapUsd)} FDV`;
      }
      return `${modules.holderAirdropPct}% of hook fees → holder drops`;
    }
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
  "dynamic-fees": "Fees scale with LP depth used",
  "buyback-vesting": "Creator fees vest over time or until a mcap target",
  "auto-burn": "Burns tokens on swaps",
  "deepen-lps": "Deepens the LP book",
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
  "max-tx": "Max swap size",
  "max-wallet": "Max wallet size",
  "dynamic-fees": "Depth-relative fees",
  "buyback-vesting": "Creator fee vest",
  "auto-burn": "Burn on swap",
  "deepen-lps": "Deepen LPs",
  "holder-airdrop": "Holder airdrops",
  "creator-share-to-hook": "Fees → hook pot",
};

/** 2–3 word label under pick cards. */
export function hookPickTagline(id: MasterHookId): string {
  return HOOK_PICK_TAGLINE[id];
}

const HOOK_PICK_DETAIL: Record<MasterHookId | "fixed-fee", string> = {
  "anti-snipe":
    "Adds a decaying tax on early buys during your launch window. Snipers pay the highest rate at open; the tax steps down over the duration you choose until it matches your base swap fee.",
  "backed-floor":
    "Skims a share of hook fees into a FloorVault as quote collateral. Floor = vault ÷ supply and only ratchets up. It is a redeemable bid, not a peg to the DEX price, so the token can trade at a large premium to the floor. Holders can redeem against the vault. Single-pair launches only.",
  "anti-mev":
    "Blocks buy-then-sell (and sell-then-buy) in the same block from the same wallet. Uses a per-origin cooldown so sandwich bots and same-block flippers get reverted.",
  "max-tx":
    "Limits how large any single swap can be relative to total supply. Oversized exact-input swaps revert. Useful against whale dumps or bot-sized trades.",
  "max-wallet":
    "Caps how much of the supply any one wallet can hold after a buy. Checked post-transfer so no wallet can accumulate beyond your chosen percentage.",
  "dynamic-fees":
    "Enables Uniswap v4 dynamic fees. Each swap pays between your min and max based on how much in-range liquidity it consumes. Shallow pools charge more for the same quote size. No oracle.",
  "buyback-vesting":
    `Routes the creator's ${CREATOR_SHARE_BPS / 100}% base-fee share into a vesting vault instead of instant escrow. Choose a linear time vest, or keep fees locked until FDV hits a USD target (all at once, or by % at 10M / 50M / 100M / 500M / 1B / 10B). Can't combine with Creator → Hook. Both spend that same ${CREATOR_SHARE_BPS / 100}% cut.`,
  "auto-burn":
    "Sends a slice of the hook fee pot to the dead address on every swap. Supply shrinks over time without manual burns or sell pressure on your token.",
  "deepen-lps":
    "Routes a share of hook fees into the launch liquidity range. Swap some quote for token when needed, then mint. Thickens the book for whales and traders instead of paying extra fees to existing LPs.",
  "holder-airdrop":
    "Accrues quote fees in a vault and pushes pro-rata drops to token holders on swap after each epoch. Optionally vest those drops until FDV hits a target (5M–10B), all at once or by %. Permissionless. Anyone can trigger the push.",
  "creator-share-to-hook":
    `Redirects your ${CREATOR_SHARE_BPS / 100}% creator cut from escrow into the same hook pot as module fees. Split across floor, burn, Deepen LPs, airdrop, or protocol based on what you enabled. Can't combine with Buyback Vesting. Both spend that same ${CREATOR_SHARE_BPS / 100}% cut.`,
  "fixed-fee":
    "Adds a flat hook tax on every swap, deducted in quote only. Pairs with protection and tokenomics modules. Leftover fees route to the protocol. Mutually exclusive with dynamic fees.",
};

/** Longer copy for pick-card and config tooltips. */
export function hookPickDetail(id: MasterHookId | "fixed-fee"): string {
  if (id === "fixed-fee") {
    return HOOK_PICK_DETAIL["fixed-fee"];
  }
  return HOOK_PICK_DETAIL[id];
}

const MODULE_SUMMARY_PHRASE_LOWER: Record<MasterHookId, string> = {
  "anti-snipe": "blocks snipers at launch",
  "backed-floor": "has a price floor",
  "anti-mev": "blocks bot trades",
  "max-tx": "limits trade size",
  "max-wallet": "limits wallet size",
  "dynamic-fees": "fee vs in-range LP depth",
  "buyback-vesting": "locks creator fees until time or mcap",
  "auto-burn": "burns tokens on swaps",
  "deepen-lps": "deepens the LP book",
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
