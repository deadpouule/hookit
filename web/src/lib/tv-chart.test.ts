import assert from "node:assert/strict";
import test from "node:test";

import { formatTvPrice } from "./tv-chart";

test("price labels use subscript zero runs below a tenth of a cent", () => {
  assert.equal(formatTvPrice(0), "0");
  assert.equal(formatTvPrice(Number.NaN), "-");
  assert.equal(formatTvPrice(0.00085495), "0.0₃85495");
  assert.equal(formatTvPrice(0.0000000097800216), "0.0₈97800");
  assert.equal(formatTvPrice(-0.00051883), "-0.0₃51883");
  assert.equal(formatTvPrice(0.0010147), "0.0010147");
  assert.equal(formatTvPrice(845_460), "845,460");
  assert.equal(formatTvPrice(0.00099999), "0.0₃99999");
  assert.equal(formatTvPrice(0.000999999), "0.0₂10000");
});
