import {
  CREATOR_SHARE_BPS,
  DEFAULT_LAUNCH_STATE,
  MAX_HOOK_TAX_BPS,
  MAX_TOTAL_FEE_BPS,
  PROTOCOL_SHARE_BPS,
} from "@/lib/constants";
import type { MasterHook, MasterHookId } from "@/lib/master-hooks";

export type HookPresetDetails = {
  title: string;
  lines: string[];
  savedAt: string;
  summary: string;
};

const LAUNCH = DEFAULT_LAUNCH_STATE.modules;

/** On-chain + launch UI defaults for tooltip copy on the hooks browse page. */
export function getHookPresetDetails(hook: MasterHook): HookPresetDetails {
  return {
    title: "Exact saved settings",
    lines: PRESET_LINES[hook.id],
    savedAt: hook.savedAt,
    summary: hook.summary,
  };
}

const PRESET_LINES: Record<MasterHookId, string[]> = {
  "anti-snipe": [
    "DEFAULT INITIAL SNIPE TAX 50% · ON-CHAIN FALLBACK",
    `LAUNCH PRESET ${LAUNCH.antiSnipeInitialTax}% INITIAL · ${LAUNCH.antiSnipeDuration}S WINDOW`,
    "DECAY TAX ON OPENING BUYS ONLY",
    "FADES TO BASE FEE OVER ANTI-SNIPE WINDOW",
    "MAX SNIPE TAX 99%",
  ],
  "backed-floor": [
    `DEFAULT ${LAUNCH.floorAllocation}% OF HOOK TAX POT → FLOORVAULT`,
    "P_FLOOR = VAULT QUOTE / CIRCULATING SUPPLY",
    "RATCHET NEVER DECREASES",
    "MAX FLOOR ALLOC 100% OF HOOK POT",
  ],
  "anti-mev": [
    "SAME-BLOCK OPPOSING SWAP COOLDOWN",
    "TRANSIENT STORAGE GUARD PER ORIGIN",
    "BLOCKS BUY→SELL OR SELL→BUY SAME BLOCK",
  ],
  "max-tx": [
    `DEFAULT CAP ${bpsToPct(LAUNCH.maxTxBps)} OF TOTAL SUPPLY PER SWAP`,
    "CHECKED ON EXACT-INPUT SWAPS",
    "REVERTS OVERSIZE TX",
    "MAX CAP 100% SUPPLY",
  ],
  "max-wallet": [
    `DEFAULT CAP ${bpsToPct(LAUNCH.maxWalletBps)} OF SUPPLY PER WALLET`,
    "CHECKED AFTER BUYS",
    "MAX CAP 100% SUPPLY",
  ],
  "dynamic-fees": [
    "UNISWAP V4 DYNAMIC_FEE_FLAG 0x800000",
    `STEADY FEE CAP ${MAX_TOTAL_FEE_BPS / 100}% (BASE + HOOK TAX)`,
    `MAX HOOK TAX ${MAX_HOOK_TAX_BPS / 100}%`,
    "QUOTE-ONLY FEE DEDUCTION",
  ],
  "buyback-vesting": [
    "CREATOR PROCEEDS → BUYBACKVAULT",
    "LINEAR VEST 5 YEARS ON-CHAIN",
    "CLAIM AFTER UNLOCK",
  ],
  "auto-burn": [
    `DEFAULT ${LAUNCH.autoBurnPct}% OF HOOK TAX POT → TOKEN BURN`,
    "BURN EXECUTED AFTER EACH SWAP",
    "MAX 50% OF HOOK POT",
  ],
  "lp-donate": [
    `DEFAULT ${LAUNCH.lpDonatePct}% OF HOOK TAX POT TO IN-RANGE LPS`,
    "HKIT FAIR-LAUNCH PRESET 50% LP DONATE",
    "RANGE CHECK ENFORCED ON DONATION",
    "MAX 50% OF HOOK POT",
  ],
  "holder-airdrop": [
    `DEFAULT ${LAUNCH.holderAirdropPct}% OF HOOK TAX POT → AIRDROP VAULT`,
    "AIRDROP PUSH ON SWAP AFTER 15M EPOCH",
    "PRO-RATA BY TOKEN BALANCE",
    "MAX 50% OF HOOK POT",
  ],
  "creator-share-to-hook": [
    `CREATOR SHARE ${CREATOR_SHARE_BPS / 100}% → HOOK POT INSTEAD OF ESCROW`,
    `PROTOCOL SHARE ${PROTOCOL_SHARE_BPS / 100}% UNCHANGED`,
    "SAME MODULE SPLIT AS HOOK TAX ROUTING",
  ],
};

function bpsToPct(bps: number): string {
  if (bps % 100 === 0) return `${bps / 100}%`;
  return `${(bps / 100).toFixed(2)}%`;
}
