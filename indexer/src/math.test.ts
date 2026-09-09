import assert from "node:assert/strict";
import test from "node:test";

import { quotePerToken, quotePerTokenFromAmounts } from "./math.js";

test("quotePerTokenFromAmounts prices USDG buy correctly", () => {
  const price = quotePerTokenFromAmounts(
    990_000n,
    196_801_815_263_355_316_846_898n,
    18,
    6,
  );
  const n = Number(price);
  assert.ok(n > 4.9e-6 && n < 5.2e-6);
});

test("quotePerToken scales sqrtPrice for 18-dec token vs 6-dec USDG", () => {
  const sqrtPriceX96 = 177_785_530_145_260_937_583n;
  const price = Number(quotePerToken(sqrtPriceX96, true, 18, 6));
  assert.ok(price > 4.9e-6 && price < 5.2e-6);
});
