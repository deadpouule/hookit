import assert from "node:assert/strict";
import test from "node:test";

import { tokenShareTitle } from "@/lib/site-metadata";

test("token share title is Name ($TICKER) - hookit", () => {
  assert.equal(tokenShareTitle("vitalik", "BIT"), "vitalik ($BIT) - hookit");
  assert.equal(tokenShareTitle("ZZZ", "ZZZ"), "ZZZ ($ZZZ) - hookit");
});
