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

function tradingFeesDetail(form: LaunchFormState): string {
  const parts: string[] = [];
  if (form.modules.dynamicFees) parts.push("Dynamic Fees");
  if (form.hookTaxBps > 0) parts.push(`Fixed ${formatBps(form.hookTaxBps)}`);
  if (form.modules.creatorShareToHook) parts.push("Creator → Hook");
  return parts.length > 0 ? parts.join(" · ") : "None selected";
}

function feeSplitDetail(form: LaunchFormState): string {
  const parts: string[] = [];
  if (form.modules.autoBurn) parts.push(`Burn ${form.modules.autoBurnPct}%`);
  if (form.modules.backedFloor) parts.push(`Floor ${form.modules.floorAllocation}%`);
  if (form.modules.deepenLps) parts.push(`LPs ${form.modules.deepenLpsPct}%`);
  if (form.modules.holderAirdrop) parts.push(`Airdrop ${form.modules.holderAirdropPct}%`);
  return parts.length > 0 ? parts.join(" · ") : "No hook-tax modules";
}

export function summarizeCompletedSteps(
  step: number,
  form: LaunchFormState,
): WizardContextBlock[] {
  const blocks: WizardContextBlock[] = [];

  if (step > 1) {
    blocks.push({
      title: "Token & pair",
      detail: `${form.name || "Untitled"} · $${form.ticker || "???"} · ${pairSummary(form)}`,
    });
  }

  if (step > 2) {
    blocks.push({
      title: "Protection",
      detail: enabledHookTitles(form, LAUNCH_WIZARD_HOOK_IDS[2]),
    });
  }

  if (step > 3) {
    blocks.push({
      title: "Tokenomics",
      detail: enabledHookTitles(form, LAUNCH_WIZARD_HOOK_IDS[3]),
    });
  }

  if (step > 4) {
    blocks.push({
      title: "Trading fees",
      detail: tradingFeesDetail(form),
    });
  }

  if (step > 5) {
    blocks.push({
      title: "Fee split",
      detail: feeSplitDetail(form),
    });
  }

  return blocks;
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
    case 4:
      return {
        title: "Tokenomics",
        detail: enabledHookTitles(form, LAUNCH_WIZARD_HOOK_IDS[3]),
      };
    case 5:
      return {
        title: "Trading fees",
        detail: tradingFeesDetail(form),
      };
    case 6:
      return {
        title: "Fee split",
        detail: feeSplitDetail(form),
      };
    default:
      return null;
  }
}

const NEXT_STEP_HINTS: Record<number, string> = {
  2: "Anti-MEV, anti-snipe, max tx and max wallet caps.",
  3: "Burn, floor, vesting, Deepen LPs, and holder airdrops.",
  4: "Dynamic Fees, fixed hook tax, and creator share routing.",
  5: "Split hook tax and see how much of each swap each module gets.",
  6: "Final review, optional dev buy, and launch.",
};

export function summarizeNextStep(step: number): WizardContextBlock | null {
  const nextStep = MASTER_LAUNCH_STEPS.find((item) => item.id === step + 1);
  if (!nextStep) return null;
  return {
    title: nextStep.label,
    detail: NEXT_STEP_HINTS[nextStep.id] ?? "",
  };
}
