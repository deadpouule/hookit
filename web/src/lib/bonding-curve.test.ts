import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEther } from "viem";

import { DEFAULT_TOTAL_SUPPLY } from "./contracts/config";
import { initialBondingVirtualState } from "./dev-buy-launch";

const GRADUATION = parseEther("4.2");

test("curve sells exactly the curve supply once the graduation quote is collected", () => {
  const { virtualQuote, virtualToken, curveSupply } = initialBondingVirtualState(GRADUATION);
  // Constant product: quote needed to buy the whole curve supply.
  const k = virtualQuote * virtualToken;
  const quoteNeeded = k / (virtualToken - curveSupply) - virtualQuote;
  const diff = quoteNeeded > GRADUATION ? quoteNeeded - GRADUATION : GRADUATION - quoteNeeded;
  assert.ok(diff <= 10n, `curve sells out at ${quoteNeeded} wei, expected ${GRADUATION}`);
});

test("terminal curve price equals the graduated LP price", () => {
  const { virtualQuote, virtualToken, curveSupply } = initialBondingVirtualState(GRADUATION);
  const lpSupply = DEFAULT_TOTAL_SUPPLY - curveSupply;
  const terminalPrice = Number(virtualQuote + GRADUATION) / Number(virtualToken - curveSupply);
  const lpPrice = Number(GRADUATION) / Number(lpSupply);
  assert.ok(Math.abs(terminalPrice / lpPrice - 1) < 1e-9, `${terminalPrice} vs ${lpPrice}`);
});

test("virtual reserves scale with the graduation quote", () => {
  const eth = initialBondingVirtualState(GRADUATION);
  const usd = initialBondingVirtualState(18_000n * 10n ** 6n);
  assert.equal(eth.virtualToken, usd.virtualToken);
  assert.equal(eth.virtualQuote, GRADUATION / 3n);
  assert.equal(usd.virtualQuote, 6_000n * 10n ** 6n);
});
