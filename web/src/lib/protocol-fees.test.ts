import assert from "node:assert/strict";
import test from "node:test";

import { quoteVolumeToUsd } from "./server-protocol-stats";

test("values stock quote volume with its stock USD price instead of ETH/USD", () => {
  const stock = "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f";
  const result = quoteVolumeToUsd(
    [
      {
        quote: stock,
        quoteDecimals: 18,
        volumeQuote: "6483135565291304081",
        buyVolumeQuote: "3335407622097511254",
        sellVolumeQuote: "3147727943193792827",
      },
    ],
    2_491,
    new Map([[stock, 309.775]]),
  );

  assert.ok(result.total > 2_000 && result.total < 2_010);
  assert.ok(result.buy > 1_030 && result.buy < 1_040);
  assert.ok(result.sell > 970 && result.sell < 980);
});
