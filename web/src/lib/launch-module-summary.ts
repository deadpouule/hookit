import { HOOK_MARK_TO_MASTER, HOOK_MARKS, type HookId } from "@/lib/hook-marks";
import { HOOK_MODULE_FIELD, MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";

export type ModuleSummaryLine = {
  id: MasterHookId | "creator-share-to-hook";
  title: string;
  detail: string;
};

export function isModuleEnabled(modules: LaunchModules, id: MasterHookId): boolean {
  return Boolean(modules[HOOK_MODULE_FIELD[id]]);
}

export function moduleDetailLine(id: MasterHookId, modules: LaunchModules): string {
  switch (id) {
    case "anti-snipe":
      return `${modules.antiSnipeDuration}s · ${modules.antiSnipeInitialTax}% open tax`;
    case "backed-floor":
      return `${modules.floorAllocation}% of hook tax → floor vault`;
    case "anti-mev":
      return "Same-block opposing swap blocked";
    case "max-tx":
      return `Max ${(modules.maxTxBps / 100).toFixed(1)}% supply / swap`;
    case "max-wallet":
      return `Max ${(modules.maxWalletBps / 100).toFixed(1)}% supply / wallet`;
    case "dynamic-fees":
      return "Volatility-adjusted LP fee flag";
    case "buyback-vesting": {
      const days = modules.buybackVestingDurationDays ?? 365 * 5;
      return days >= 365 ? `Creator fees vest ${(days / 365).toFixed(1)}y` : `Creator fees vest ${days}d`;
    }
    case "auto-burn":
      return `${modules.autoBurnPct}% of hook tax burned`;
    case "lp-donate":
      return `${modules.lpDonatePct}% of hook tax → in-range LPs`;
    case "holder-airdrop":
      return `${modules.holderAirdropPct}% of hook tax · 15m epochs`;
    case "creator-share-to-hook":
      return "70% of base fee → hook pot";
    default:
      return "Enabled";
  }
}

/** Short hint shown on module cards when toggled on. */
export function moduleCardHint(id: MasterHookId, modules: LaunchModules): string {
  if (!isModuleEnabled(modules, id)) return "";
  const detail = moduleDetailLine(id, modules);
  return detail.length > 42 ? `${detail.slice(0, 40)}…` : detail;
}

export function listEnabledModuleSummaries(
  modules: LaunchModules,
  opts?: { includeCreatorShare?: boolean },
): ModuleSummaryLine[] {
  const lines: ModuleSummaryLine[] = MASTER_HOOKS.filter(
    (h) => h.id !== "creator-share-to-hook" && isModuleEnabled(modules, h.id),
  ).map((h) => ({
    id: h.id,
    title: h.title,
    detail: moduleDetailLine(h.id, modules),
  }));

  if (opts?.includeCreatorShare && modules.creatorShareToHook) {
    lines.push({
      id: "creator-share-to-hook",
      title: "Creator → hook",
      detail: moduleDetailLine("creator-share-to-hook", modules),
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

export function hookMarkSummaryDetail(id: HookId, modules: LaunchModules): string {
  if (id === "quoteFee") return "1% base · quote-only on swaps";
  if (id === "custom") return HOOK_MARKS.custom.hint;

  const masterId = HOOK_MARK_TO_MASTER[id];
  if (masterId) return moduleDetailLine(masterId, modules);

  return HOOK_MARKS[id]?.hint ?? "Enabled";
}
