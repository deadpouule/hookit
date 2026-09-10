import assert from "node:assert/strict";
import test from "node:test";

import { geckoOhlcvPath, parseOhlcvList, pickGeckoPoolForToken } from "./geckoterminal";

test("geckoOhlcvPath matches Sentry GeckoTerminal buckets", () => {
  assert.deepEqual(geckoOhlcvPath("1m"), { timeframe: "minute", aggregate: 1 });
  assert.deepEqual(geckoOhlcvPath("5m"), { timeframe: "minute", aggregate: 5 });
  assert.deepEqual(geckoOhlcvPath("15m"), { timeframe: "minute", aggregate: 15 });
  assert.deepEqual(geckoOhlcvPath("1h"), { timeframe: "hour", aggregate: 1 });
  assert.deepEqual(geckoOhlcvPath("4h"), { timeframe: "hour", aggregate: 4 });
  assert.deepEqual(geckoOhlcvPath("1D"), { timeframe: "day", aggregate: 1 });
  assert.equal(geckoOhlcvPath("ALL"), null);
});

test("parseOhlcvList sorts newest-first rows and merges duplicate buckets", () => {
  const bars = parseOhlcvList([
    [1_700_000_600, 2, 2.5, 1.5, 2.2, 10],
    [1_700_000_300, 1, 1.2, 0.9, 1.1, 4],
    [1_700_000_300, 1.1, 1.4, 0.8, 1.3, 1],
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.time, 1_700_000_300);
  assert.equal(bars[0]!.open, 1);
  assert.equal(bars[0]!.high, 1.4);
  assert.equal(bars[0]!.low, 0.8);
  assert.equal(bars[0]!.close, 1.3);
  assert.equal(bars[0]!.volume, 5);
  assert.equal(bars[1]!.close, 2.2);
});

test("pickGeckoPoolForToken keeps the deepest pool and token side", () => {
  const token = "0x0200c29006150606b650577bbe7b6248f58470c1";
  const pick = pickGeckoPoolForToken(
    {
      data: [
        {
          attributes: { address: "0x1111111111111111111111111111111111111111", reserve_in_usd: "10" },
          relationships: {
            base_token: { data: { id: "ink_0x0200c29006150606b650577bbe7b6248f58470c1" } },
            quote_token: { data: { id: "ink_0x4200000000000000000000000000000000000006" } },
          },
        },
        {
          attributes: { address: "0x2222222222222222222222222222222222222222", reserve_in_usd: "99" },
          relationships: {
            base_token: { data: { id: "ink_0x4200000000000000000000000000000000000006" } },
            quote_token: { data: { id: "ink_0x0200c29006150606b650577bbe7b6248f58470c1" } },
          },
        },
      ],
    },
    "ink",
    token,
  );
  assert.equal(pick?.address, "0x2222222222222222222222222222222222222222");
  assert.equal(pick?.tokenSide, "quote");
});
