import assert from "node:assert/strict";
import test from "node:test";

import { quotronSwapFeasible } from "./arb-usdg.ts";

const MIN = 4295128739n;
const MAX = 1461446703485210103287273052203988822378723970342n;

test("quotronSwapFeasible: stock sell blocked at min tick", () => {
  assert.equal(quotronSwapFeasible(MIN + 1n, true), false);
});

test("quotronSwapFeasible: USDG buy still ok at min tick", () => {
  assert.equal(quotronSwapFeasible(MIN + 1n, false), true);
});

test("quotronSwapFeasible: USDG buy blocked at max tick", () => {
  assert.equal(quotronSwapFeasible(MAX - 1n, false), false);
});

test("quotronSwapFeasible: stock sell ok at max tick", () => {
  assert.equal(quotronSwapFeasible(MAX - 1n, true), true);
});
