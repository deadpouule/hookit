import assert from "node:assert/strict";
import test from "node:test";

import { creatorCutLock, feeSplitStepSubtitle, formatEnglishList, masterHookWizardStep } from "./launch-wizard";
import { DEFAULT_MASTER_WIZARD_STATE } from "./constants";

test("creatorCutLock blocks the rival hook, not the selected one", () => {
  assert.equal(creatorCutLock("buyback-vesting", { buybackVesting: true, creatorShareToHook: false }), null);
  assert.equal(
    creatorCutLock("creator-share-to-hook", { buybackVesting: false, creatorShareToHook: true }),
    null,
  );

  const vsCreator = creatorCutLock("buyback-vesting", {
    buybackVesting: false,
    creatorShareToHook: true,
  });
  assert.ok(vsCreator?.card.includes("Creator → Hook"));

  const vsBuyback = creatorCutLock("creator-share-to-hook", {
    buybackVesting: true,
    creatorShareToHook: false,
  });
  assert.ok(vsBuyback?.card.includes("Buyback Vesting"));
});

test("masterHookWizardStep maps tokenomics before trading fees", () => {
  assert.equal(masterHookWizardStep("auto-burn"), 3);
  assert.equal(masterHookWizardStep("buyback-vesting"), 3);
  assert.equal(masterHookWizardStep("dynamic-fees"), 4);
  assert.equal(masterHookWizardStep("fixed-fee"), 4);
  assert.equal(masterHookWizardStep("anti-snipe"), 2);
});

test("formatEnglishList joins hook titles", () => {
  assert.equal(formatEnglishList([]), "");
  assert.equal(formatEnglishList(["Auto-Burn"]), "Auto-Burn");
  assert.equal(formatEnglishList(["Auto-Burn", "Deepen LPs"]), "Auto-Burn and Deepen LPs");
  assert.equal(
    formatEnglishList(["Auto-Burn", "Deepen LPs", "Holder Airdrop"]),
    "Auto-Burn, Deepen LPs, and Holder Airdrop",
  );
});

test("feeSplitStepSubtitle lists only enabled fee-route hooks", () => {
  const none = feeSplitStepSubtitle(DEFAULT_MASTER_WIZARD_STATE.modules);
  assert.equal(none, "Configure how much of each swap goes to your hook modules.");

  const burnAndLps = feeSplitStepSubtitle({
    ...DEFAULT_MASTER_WIZARD_STATE.modules,
    autoBurn: true,
    deepenLps: true,
  });
  assert.equal(burnAndLps, "Configure how much of each swap goes to Auto-Burn and Deepen LPs.");

  const allRoutes = feeSplitStepSubtitle({
    ...DEFAULT_MASTER_WIZARD_STATE.modules,
    autoBurn: true,
    backedFloor: true,
    deepenLps: true,
    holderAirdrop: true,
  });
  assert.equal(
    allRoutes,
    "Configure how much of each swap goes to Backed Floor, Auto-Burn, Deepen LPs, and Holder Airdrop.",
  );
});
