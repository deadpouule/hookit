import assert from "node:assert/strict";
import test from "node:test";

import { MARKET_TOKENS } from "./market-tokens";
import {
  TRENDING_MIN_CHANGE,
  filterBySort,
  selectTrendingTokens,
} from "./market-rankings";

test("trending only keeps tokens with a real 1h move", () => {
  const mixed = [
    { ...MARKET_TOKENS[0], id: "up", change1h: 8 },
    { ...MARKET_TOKENS[0], id: "flat", change1h: 0 },
    { ...MARKET_TOKENS[0], id: "dust", change1h: 0.4 },
    { ...MARKET_TOKENS[0], id: "down", change1h: -3 },
  ];
  const trending = selectTrendingTokens(mixed, 8);
  assert.deepEqual(
    trending.map((token) => token.id),
    ["up"],
  );
  assert.ok(TRENDING_MIN_CHANGE >= 1);
  assert.deepEqual(
    filterBySort(mixed, "trend").map((token) => token.id),
    ["up"],
  );
});
