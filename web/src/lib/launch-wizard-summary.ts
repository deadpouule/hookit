import { formatBps } from "@/lib/format";
import { isModuleEnabled } from "@/lib/launch-module-summary";
import { LAUNCH_WIZARD_HOOK_IDS, MASTER_LAUNCH_STEPS } from "@/lib/launch-wizard";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import { formatPairingTicker } from "@/lib/pairing-tokens";
import type { LaunchFormState } from "@/lib/types";

export type WizardContextBlock = {
  title: string;
  detail: string;
};

function enabledHookTitles(form: LaunchFormState, ids: MasterHookId[]): string {
  const titles = MASTER_HOOKS.filter(
    (hook) => ids.includes(hook.id) && isModuleEnabled(form.modules, hook.id),
  ).map((hook) => hook.title);
  return titles.length > 0 ? titles.join(", ") : "None selected";
}

function pairSummary(form: LaunchFormState): string {
  if (form.markets.length > 1) {
    return form.markets
      .map((market) => `${formatPairingTicker(market.id)} ${(market.bps / 100).toFixed(0)}%`)
      .join(" · ");
  }
  return formatPairingTicker(form.markets[0]?.id ?? form.quoteAsset);
}

export function summarizePreviousStep(
  step: number,
  form: LaunchFormState,
): WizardContextBlock | null {
  switch (step) {
    case 2:
      return {
        title: "Token & pair",
        detail: `${form.name || "Untitled"} · $${form.ticker || "???"} · ${pairSummary(form)}`,
      };
    case 3:
      return {
        title: "Protection",
        detail: enabledHookTitles(form, LAUNCH_WIZARD_HOOK_IDS[2]),
      };
    case 4: {
      const parts: string[] = [];
      if (form.modules.dynamicFees) parts.push("Dynamic fees");
      if (form.hookTaxBps > 0) parts.push(`Fixed ${formatBps(form.hookTaxBps)}`);
      if (form.modules.creatorShareToHook) parts.push("Creator → hook");
      return {
        title: "Trading fees",
        detail: parts.length > 0 ? parts.join(" · ") : "None selected",
      };
    }
    case 5:
      return {
        title: "Tokenomics",
        detail: enabledHookTitles(form, LAUNCH_WIZARD_HOOK_IDS[4]),
      };
    default:
      return null;
  }
}

const NEXT_STEP_HINTS: Record<number, string> = {
  2: "Anti-MEV, anti-snipe, max tx and max wallet caps.",
  3: "Dynamic fees, fixed hook tax, and creator share routing.",
  4: "Burn, floor, vesting, LP donate, and holder airdrops.",
  5: "Final review, optional dev buy, and launch.",
};

export function summarizeNextStep(step: number): WizardContextBlock | null {
  const nextStep = MASTER_LAUNCH_STEPS.find((item) => item.id === step + 1);
  if (!nextStep) return null;
  return {
    title: nextStep.label,
    detail: NEXT_STEP_HINTS[nextStep.id] ?? "",
  };
}
