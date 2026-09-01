import type { MasterHookId } from "@/lib/master-hooks";

export const MASTER_LAUNCH_STEPS = [
  { id: 1, label: "Token & pair" },
  { id: 2, label: "Protection" },
  { id: 3, label: "Trading fees" },
  { id: 4, label: "Tokenomics" },
  { id: 5, label: "Review & launch" },
] as const;

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
