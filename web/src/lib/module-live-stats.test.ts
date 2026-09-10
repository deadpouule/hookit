import assert from "node:assert/strict";
import test from "node:test";

import { formatCompactQuoteAmount, formatLiveQuoteWei } from "./format";
import {
  buybackClaimableWei,
  floorPremiumPct,
  formatFloorPremiumPct,
  formatVestRemaining,
  moduleLiveStatLine,
} from "./module-live-stats";
import type { LaunchModules } from "./types";

test("buybackClaimableWei unlocks linearly each second", () => {
  const amount = 604_800n * 10n ** 9n;
  const durationSec = 604_800;
  const startSec = 1_700_000_000;
  const t0 = buybackClaimableWei({
    amount,
    startSec,
    claimed: 0n,
    durationSec,
    nowSec: startSec,
  });
  const t1 = buybackClaimableWei({
    amount,
    startSec,
    claimed: 0n,
    durationSec,
    nowSec: startSec + 1,
  });
  const t2 = buybackClaimableWei({
    amount,
    startSec,
    claimed: 0n,
    durationSec,
    nowSec: startSec + 2,
  });
  assert.equal(t0, 0n);
  assert.equal(t1, 10n ** 9n);
  assert.equal(t2, 2n * 10n ** 9n);
});

test("buybackClaimableWei subtracts already claimed", () => {
  const unlocked = buybackClaimableWei({
    amount: 1000n,
    startSec: 10,
    claimed: 400n,
    durationSec: 100,
    nowSec: 60,
  });
  assert.equal(unlocked, 100n);
});

test("formatVestRemaining includes seconds", () => {
  assert.equal(formatVestRemaining(0), "unlocked");
  assert.equal(formatVestRemaining(9), "9s");
  assert.equal(formatVestRemaining(75), "1m 15s");
  assert.equal(formatVestRemaining(86_400 + 3661), "1d 1h 1m 01s");
});

test("formatLiveQuoteWei keeps enough digits to show a 1s tick", () => {
  assert.equal(formatLiveQuoteWei(0n, 18), "0");
  assert.equal(formatLiveQuoteWei(941_234_567n, 18), "9.41234e-10");
  const a = formatLiveQuoteWei(941_234_567n, 18);
  const b = formatLiveQuoteWei(942_234_567n, 18);
  assert.notEqual(a, b);
});

test("floorPremiumPct is (spot - floor) / floor — 1M vs 100k mcap is +900%", () => {
  assert.equal(floorPremiumPct(10, 1), 900);
  assert.equal(floorPremiumPct(1, 1), 0);
  assert.equal(floorPremiumPct(9, 10), -10);
  assert.equal(floorPremiumPct(null, 1), null);
  assert.equal(floorPremiumPct(1, 0), null);
  assert.equal(floorPremiumPct(0, 1), null);
  const tiny = floorPremiumPct(1e-8, 1e-9);
  assert.ok(tiny != null && Math.abs(tiny - 900) < 1e-6);
});

test("formatFloorPremiumPct", () => {
  assert.equal(formatFloorPremiumPct(900), "+900% prem");
  assert.equal(formatFloorPremiumPct(12.4), "+12% prem");
  assert.equal(formatFloorPremiumPct(1.26), "+1.3% prem");
  assert.equal(formatFloorPremiumPct(0.2), "at floor");
  assert.equal(formatFloorPremiumPct(-8.2), "-8.2% prem");
});

test("backed-floor chip includes premium vs DEX spot", () => {
  const modules = { floorAllocation: 40 } as LaunchModules;
  const line = moduleLiveStatLine(
    "backed-floor",
    modules,
    {
      floorPriceHuman: 1e-9,
      spotPriceHuman: 1e-8,
      floorReserveHuman: 0.1,
      airdropPendingHuman: null,
      airdropSecondsLeft: null,
      airdropLastAtSec: null,
      airdropEpochSec: null,
      burnedPct: null,
      lpDonatePendingHuman: null,
      buybackTotalHuman: null,
      buybackClaimableHuman: null,
      buybackClaimedHuman: null,
      buybackVestSecondsLeft: null,
      quoteLabel: "ETH",
    },
    {},
  );
  assert.equal(line, `40% · Vault 0.1 ETH · Floor ${formatCompactQuoteAmount(1e-9)} ETH · +900% prem`);
});
