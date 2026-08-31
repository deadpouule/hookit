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

/** Token-aware tooltip: config from on-chain bitmask, not generic catalog copy. */
export function moduleTooltipText(
  _description: string,
  id: MasterHookId,
  modules: LaunchModules,
  hookTaxBps = 0,
): string {
  return moduleDetailLine(id, modules, hookTaxBps);
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
  opts?: { includeCreatorShare?: boolean; hookTaxBps?: number },
): ModuleSummaryLine[] {
  const hookTaxBps = opts?.hookTaxBps ?? 0;
  const lines: ModuleSummaryLine[] = MASTER_HOOKS.filter(
    (h) => h.id !== "creator-share-to-hook" && isModuleEnabled(modules, h.id),
  ).map((h) => ({
    id: h.id,
    title: h.title,
    detail: moduleDetailLine(h.id, modules, hookTaxBps),
  }));

  if (opts?.includeCreatorShare && modules.creatorShareToHook) {
    lines.push({
      id: "creator-share-to-hook",
      title: "Creator → hook",
      detail: moduleDetailLine("creator-share-to-hook", modules, hookTaxBps),
    });
  }

  return lines;
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
  const phrases = hookIds.map((id) => MODULE_SUMMARY_PHRASE[id]).filter(Boolean);
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
