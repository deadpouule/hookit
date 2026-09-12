import type { MasterHookId } from "@/lib/master-hooks";
import type { LaunchModules } from "@/lib/types";

export const MASTER_LAUNCH_STEPS = [
  { id: 1, label: "Token & pair" },
  { id: 2, label: "Protection" },
  { id: 3, label: "Trading fees" },
  { id: 4, label: "Tokenomics" },
  { id: 5, label: "Fee split" },
  { id: 6, label: "Review & launch" },
] as const;

export const MASTER_WIZARD_STEP_SUBTITLES: Record<
  (typeof MASTER_LAUNCH_STEPS)[number]["id"],
  string | null
> = {
  1: null,
  2: "Shield your launch — block bots, limit trade size, and limit wallet holdings.",
  3: "Tune swap fees — pick dynamic volume pricing or a fixed hook tax. Creator → Hook and Buyback Vesting can't both take the 70% creator cut.",
  4: "Long-term token mechanics — burns, floor, vesting, LP rewards, and holder airdrops. Buyback Vesting can't combine with Creator → Hook.",
  5: "Split the hook tax — see how much of each swap goes to burn, floor, LPs, and airdrops.",
  6: "Review your token and launch when ready.",
};

export const MASTER_WIZARD_STEP_INTRO =
  "Name your token, pick a quote pair, then stack protection, fees, and tokenomics hooks.";

/** Hook groups per wizard step (Master launch). */
export const LAUNCH_WIZARD_HOOK_IDS: Record<2 | 3 | 4, MasterHookId[]> = {
  2: ["anti-mev", "anti-snipe", "max-tx", "max-wallet"],
  3: ["dynamic-fees", "creator-share-to-hook"],
  4: ["holder-airdrop", "auto-burn", "backed-floor", "buyback-vesting", "deepen-lps"],
};

export function masterHookWizardStep(hookId: MasterHookId | "fixed-fee"): 2 | 3 | 4 {
  if (hookId === "fixed-fee") return 3;
  if (LAUNCH_WIZARD_HOOK_IDS[2].includes(hookId)) return 2;
  if (LAUNCH_WIZARD_HOOK_IDS[3].includes(hookId)) return 3;
  return 4;
}

/**
 * Buyback Vesting and Creator → Hook both spend the creator's 70% of the 1%
 * base fee. Return a lock reason when the other one is already on.
 */
export function creatorCutLock(
  id: MasterHookId,
  modules: Pick<LaunchModules, "buybackVesting" | "creatorShareToHook">,
): { card: string; detail: string } | null {
  if (id === "buyback-vesting" && modules.creatorShareToHook) {
    return {
      card: "Can't combine with Creator → Hook",
      detail:
        "Both take the same 70% creator cut. Turn off Creator → Hook in Trading fees first.",
    };
  }
  if (id === "creator-share-to-hook" && modules.buybackVesting) {
    return {
      card: "Can't combine with Buyback Vesting",
      detail:
        "Both take the same 70% creator cut. Turn off Buyback Vesting in Tokenomics first.",
    };
  }
  return null;
}
