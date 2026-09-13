import assert from "node:assert/strict";
import test from "node:test";

import { allowDemoCatalog } from "./live-data";
import { getAllPoolIds, getDetailPool } from "./pools";

test("demo catalog stays off outside local development", () => {
  assert.equal(process.env.NODE_ENV === "development", false);
  assert.equal(allowDemoCatalog(), false);
  assert.equal(getDetailPool("1"), undefined);
  assert.deepEqual(getAllPoolIds(), []);
});
