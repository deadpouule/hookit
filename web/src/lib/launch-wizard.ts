import type { MasterHookId } from "@/lib/master-hooks";

export const MASTER_LAUNCH_STEPS = [
  { id: 1, label: "Token & pair" },
  { id: 2, label: "Protection" },
  { id: 3, label: "Trading fees" },
  { id: 4, label: "Tokenomics" },
  { id: 5, label: "Review & launch" },
] as const;

export const MASTER_WIZARD_STEP_SUBTITLES: Record<
  (typeof MASTER_LAUNCH_STEPS)[number]["id"],
  string | null
> = {
  1: null,
  2: "Shield your launch — block bots, cap trade size, and limit wallet holdings.",
  3: "Tune swap fees — dynamic volume pricing, a fixed hook fee, or routing creator share into your hook pot.",
  4: "Long-term token mechanics — burns, floor, vesting, LP rewards, and holder airdrops.",
  5: "Review your token and launch when ready.",
};

/** Hook groups per wizard step (Master launch). */
export const LAUNCH_WIZARD_HOOK_IDS: Record<2 | 3 | 4, MasterHookId[]> = {
  2: ["anti-mev", "anti-snipe", "max-tx", "max-wallet"],
  3: ["dynamic-fees", "creator-share-to-hook"],
  4: ["holder-airdrop", "auto-burn", "backed-floor", "buyback-vesting", "lp-donate"],
};

export function masterHookWizardStep(hookId: MasterHookId): 2 | 3 | 4 {
  if (LAUNCH_WIZARD_HOOK_IDS[2].includes(hookId)) return 2;
  if (LAUNCH_WIZARD_HOOK_IDS[3].includes(hookId)) return 3;
  return 4;
}
