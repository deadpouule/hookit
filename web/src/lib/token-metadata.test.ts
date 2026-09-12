import assert from "node:assert/strict";
import test from "node:test";

import { definedChartUrl, uniswapSwapUrl } from "./token-metadata";

test("definedChartUrl builds an Ink Defined chart link for the token", () => {
  const token = "0x51a700000000000000000000000000000000d228";
  const url = definedChartUrl(token);
  assert.equal(url, "https://www.defined.fi/ink/0x51a700000000000000000000000000000000d228");
});

test("definedChartUrl ignores a missing or junk address", () => {
  assert.equal(definedChartUrl(undefined), undefined);
  assert.equal(definedChartUrl("not-an-address"), undefined);
});

test("uniswapSwapUrl builds an Ink swap deep-link for the token", () => {
  const token = "0x51a700000000000000000000000000000000d228";
  const url = uniswapSwapUrl(token);
  assert.ok(url);
  assert.ok(url.startsWith("https://app.uniswap.org/swap?"));
  assert.match(url, /chain=ink/);
  assert.match(url, /outputCurrency=0x51a700000000000000000000000000000000d228/);
  assert.match(url, /inputCurrency=NATIVE/);
});

test("uniswapSwapUrl uses the quote token as input when paired", () => {
  const url = uniswapSwapUrl(
    "0x51a700000000000000000000000000000000d228",
    "0xe343167631d89B6Ffc58B88d6b7fB0228795491D",
  );
  assert.ok(url);
  assert.match(url, /inputCurrency=0xe343167631d89B6Ffc58B88d6b7fB0228795491D/);
});

test("uniswapSwapUrl ignores a missing or junk address", () => {
  assert.equal(uniswapSwapUrl(undefined), undefined);
  assert.equal(uniswapSwapUrl("not-an-address"), undefined);
});
