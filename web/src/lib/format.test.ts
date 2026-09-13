import assert from "node:assert/strict";
import test from "node:test";

import { changeTone, changeToneTextClass } from "./format";

test("0.00% and tiny noise are flat, not green", () => {
  assert.equal(changeTone(0), "flat");
  assert.equal(changeTone(0.004), "flat");
  assert.equal(changeTone(-0.004), "flat");
  assert.equal(changeTone(null), "flat");
  assert.equal(changeTone(Number.NaN), "flat");
  assert.equal(changeToneTextClass(0), "text-zinc-500");
});

test("real moves keep up/down polarity", () => {
  assert.equal(changeTone(0.01), "up");
  assert.equal(changeTone(-2.4), "down");
  assert.equal(changeToneTextClass(1), "text-emerald-400");
  assert.equal(changeToneTextClass(-1), "text-red-400");
});
