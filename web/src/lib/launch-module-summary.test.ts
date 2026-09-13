import assert from "node:assert/strict";
import test from "node:test";

import { BACKED_FLOOR_VOLUME_EXAMPLE, floorFromVolumeUsd, hookPickDetail } from "./launch-module-summary";
import { MASTER_HOOKS } from "./master-hooks";

test("floorFromVolumeUsd is volume × hook tax when the pot is 100% floor", () => {
  assert.equal(floorFromVolumeUsd(1_000_000, 2), 20_000);
  assert.equal(floorFromVolumeUsd(10_000_000, 2), 200_000);
  assert.equal(floorFromVolumeUsd(1_000_000, 5), 50_000);
  assert.equal(floorFromVolumeUsd(10_000_000, 5), 500_000);
  assert.equal(floorFromVolumeUsd(1_000_000, 2, 50), 10_000);
});

test("backed floor tooltip example uses 2% / 5% volume rows", () => {
  assert.match(BACKED_FLOOR_VOLUME_EXAMPLE.intro, /\$5k launch/);
  assert.deepEqual(
    BACKED_FLOOR_VOLUME_EXAMPLE.groups.map((group) => [group.taxPct, group.rows]),
    [
      [2, [
        { volume: "$1M", floor: "~$20k" },
        { volume: "$10M", floor: "~$200k" },
      ]],
      [5, [
        { volume: "$1M", floor: "~$50k" },
        { volume: "$10M", floor: "~$500k" },
      ]],
    ],
  );
  assert.match(hookPickDetail("backed-floor"), /More volume = higher floor/);
  assert.match(
    MASTER_HOOKS.find((hook) => hook.id === "backed-floor")?.description ?? "",
    /More volume = higher floor/,
  );
});
