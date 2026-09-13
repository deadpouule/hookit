import assert from "node:assert/strict";
import test from "node:test";

import { SITE_FAVICON, tokenShareTitle } from "@/lib/site-metadata";

test("token share title is Name ($TICKER) · hookit", () => {
  assert.equal(tokenShareTitle("vitalik", "BIT"), "vitalik ($BIT) · hookit");
  assert.equal(tokenShareTitle("ZZZ", "ZZZ"), "ZZZ ($ZZZ) · hookit");
});

test("browser tab icon is the owl, not the old infinity or mask file", () => {
  assert.match(SITE_FAVICON, /hookit-owl-favicon\.png/);
  assert.equal(SITE_FAVICON.includes("hookit-mark.png"), false);
  assert.equal(SITE_FAVICON.includes("favicon.ico"), false);
});
