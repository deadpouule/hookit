import assert from "node:assert/strict";
import test from "node:test";

import { formatLiveQuoteWei } from "./format";
import { buybackClaimableWei, formatVestRemaining } from "./module-live-stats";

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
