import assert from "node:assert/strict";
import test from "node:test";

import { fallbackStockUsd, nonCheapLaunchStocks, quotronSwapFeasible, quoteLabel } from "./arb-usdg.ts";
import { isSaneUsd, previewFromMarkets, saneStockUsd, type RankedMarket } from "./arb-sane-usd.ts";

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

const wMSTR = "0x30987adF0B11dc698438a99BA04ec3a1AB2c7EaB" as const;
const wNFLX = "0x7d87fD6A379714194a797c0bBB8B40c30D250856" as const;
const wNVDA = "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5" as const;

test("nonCheapLaunchStocks: keeps only non-cheap quotron quotes", () => {
  const launchQuotes = [wMSTR, wNVDA, wNFLX];
  const out = nonCheapLaunchStocks(launchQuotes, wNVDA);
  assert.deepEqual(out, [wMSTR, wNFLX]);
});

test("quoteLabel: known wStock symbols", () => {
  assert.equal(quoteLabel(wNFLX), "wNFLX");
  assert.equal(quoteLabel(wNVDA), "wNVDA");
});

test("fallbackStockUsd: wNFLX seed is 81.94 not 796", () => {
  assert.equal(fallbackStockUsd(wNFLX), 81.94);
});

test("saneStockUsd: rejects 10x Quotrons tick outlier", () => {
  assert.equal(isSaneUsd(796.38, 81.94), false);
  assert.equal(saneStockUsd(796.38, 81.94), 81.94);
  assert.equal(isSaneUsd(128.42, 121.57), true);
  assert.equal(saneStockUsd(128.42, 121.57), 128.42);
});

test("previewFromMarkets: dropping blown wNFLX ranks NVDA vs MSTR", () => {
  const markets: RankedMarket[] = [
    { index: 0, quote: wNVDA, fdvUsd: 5_080, factoryUsd: 211.32, saneUsd: 211.32 },
    { index: 1, quote: wMSTR, fdvUsd: 4_920, factoryUsd: 121.57, saneUsd: 121.57 },
    { index: 2, quote: wNFLX, fdvUsd: 614, factoryUsd: 796.38, saneUsd: 81.94 },
  ];
  const all = previewFromMarkets(markets, 0, 2);
  assert.equal(all?.cheapQuote.toLowerCase(), wNFLX.toLowerCase());
  assert.equal(all?.usdgBuySane, false);

  const rest = markets.filter((m) => m.index !== all!.cheapIndex);
  const fallback = previewFromMarkets(rest, 0, 2);
  assert.equal(fallback?.cheapQuote.toLowerCase(), wMSTR.toLowerCase());
  assert.equal(fallback?.richQuote.toLowerCase(), wNVDA.toLowerCase());
  assert.equal(fallback?.usdgBuySane, true);
  assert.ok((fallback?.deviationBps ?? 0) < 500);
});

test("previewFromMarkets: two markets, drop one → null", () => {
  const markets: RankedMarket[] = [
    { index: 0, quote: wNVDA, fdvUsd: 5_000, factoryUsd: 211.32, saneUsd: 211.32 },
    { index: 1, quote: wNFLX, fdvUsd: 614, factoryUsd: 796.38, saneUsd: 81.94 },
  ];
  const all = previewFromMarkets(markets, 1, 0);
  const rest = markets.filter((m) => m.index !== all!.cheapIndex);
  assert.equal(previewFromMarkets(rest, 1, 0), null);
});
