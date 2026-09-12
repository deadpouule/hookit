import { CREATOR_SHARE_BPS } from "@/lib/constants";
import { listEnabledFeeRoutes, type FeeRouteKey } from "@/lib/hook-fee-route";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";

const CREATOR_CUT_PCT = CREATOR_SHARE_BPS / 100;

export const MASTER_LAUNCH_STEPS = [
  { id: 1, label: "Token & pair" },
  { id: 2, label: "Protection" },
  { id: 3, label: "Tokenomics" },
  { id: 4, label: "Trading fees" },
  { id: 5, label: "Fee split" },
  { id: 6, label: "Review & launch" },
] as const;

export const MASTER_WIZARD_STEP_SUBTITLES: Record<
  (typeof MASTER_LAUNCH_STEPS)[number]["id"],
  string | null
> = {
  1: null,
  2: "Shield your launch. Block bots, limit trade size, and limit wallet holdings.",
  3: "Long-term token mechanics. Burns, floor, vesting, LP rewards, and holder airdrops. Buyback Vesting can't combine with Creator → Hook.",
  4: `Tune swap fees. Pick dynamic volume pricing or a fixed hook tax. Creator → Hook and Buyback Vesting can't both take the ${CREATOR_CUT_PCT}% creator cut.`,
  5: "Configure how much of each swap goes to your hook modules.",
  6: "Review your token and launch when ready.",
};

export const MASTER_WIZARD_STEP_INTRO =
  "Name your token, pick a quote pair, then stack protection, tokenomics, and trading-fee hooks.";

/** Hook groups per wizard step (Master launch). */
export const LAUNCH_WIZARD_HOOK_IDS: Record<2 | 3 | 4, MasterHookId[]> = {
  2: ["anti-mev", "anti-snipe", "max-tx", "max-wallet"],
  3: ["holder-airdrop", "auto-burn", "backed-floor", "buyback-vesting", "deepen-lps"],
  4: ["dynamic-fees", "creator-share-to-hook"],
};

const FEE_ROUTE_HOOK: Record<FeeRouteKey, MasterHookId> = {
  floorAllocation: "backed-floor",
  autoBurnPct: "auto-burn",
  deepenLpsPct: "deepen-lps",
  holderAirdropPct: "holder-airdrop",
};

export function formatEnglishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function feeSplitStepSubtitle(modules: LaunchModules): string {
  const titles = listEnabledFeeRoutes(modules).map((key) => {
    const hook = MASTER_HOOKS.find((item) => item.id === FEE_ROUTE_HOOK[key]);
    return hook?.title ?? key;
  });
  const list = formatEnglishList(titles);
  if (!list) return "Configure how much of each swap goes to your hook modules.";
  return `Configure how much of each swap goes to ${list}.`;
}

export function masterHookWizardStep(hookId: MasterHookId | "fixed-fee"): 2 | 3 | 4 {
  if (hookId === "fixed-fee") return 4;
  if (LAUNCH_WIZARD_HOOK_IDS[2].includes(hookId)) return 2;
  if (LAUNCH_WIZARD_HOOK_IDS[3].includes(hookId)) return 3;
  return 4;
}

/**
 * Buyback Vesting and Creator → Hook both spend the creator's share of the 1%
 * base fee. Return a lock reason when the other one is already on.
 */
export function creatorCutLock(
  id: MasterHookId,
  modules: Pick<LaunchModules, "buybackVesting" | "creatorShareToHook">,
): { card: string; detail: string } | null {
  if (id === "buyback-vesting" && modules.creatorShareToHook) {
    return {
      card: "Can't combine with Creator → Hook",
      detail: `Both take the same ${CREATOR_CUT_PCT}% creator cut. Turn off Creator → Hook in Trading fees first.`,
    };
  }
  if (id === "creator-share-to-hook" && modules.buybackVesting) {
    return {
      card: "Can't combine with Buyback Vesting",
      detail: `Both take the same ${CREATOR_CUT_PCT}% creator cut. Turn off Buyback Vesting in Tokenomics first.`,
    };
  }
  return null;
}
