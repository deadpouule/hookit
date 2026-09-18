import assert from "node:assert/strict";
import test from "node:test";

import {
  type Address,
  type PublicClient,
  zeroAddress,
} from "viem";

import {
  multiPoolMarketQuotes,
  quoteBestBuyPlan,
  quoteBestSellPlan,
  quoteBestSellRoute,
  shouldAggregateMultiBuy,
  shouldAggregateMultiSell,
  INDIVIDUAL_LEG_TIMEOUT_MS,
} from "@/lib/multi-pool-route";
import { paymentAssetById } from "@/lib/payment-assets";
import {
  NATIVE_ETH_ASSET,
  STABLE_SWAP_ASSET,
  type SwapAsset,
} from "@/lib/swap-assets";
import type { V4PoolKey } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";
import {
  INK_QUOTRON_STOCKS,
  QUOTRONS_HOOK,
} from "@/lib/xstocks";

const TOKEN = "0x1000000000000000000000000000000000000001" as Address;
const HOOK = "0x2000000000000000000000000000000000000002" as Address;
const STOCK_A = INK_QUOTRON_STOCKS[0]!.address;
const STOCK_B = INK_QUOTRON_STOCKS[1]!.address;

function keyFor(quote: Address): V4PoolKey {
  const [currency0, currency1] =
    BigInt(TOKEN) < BigInt(quote) ? [TOKEN, quote] : [quote, TOKEN];
  return {
    currency0,
    currency1,
    fee: 0,
    tickSpacing: 60,
    hooks: HOOK,
  };
}

function poolFor(quotes: Address[]): TokenPool {
  return {
    id: TOKEN,
    contractAddress: TOKEN,
    name: "Multi",
    ticker: "MULTI",
    image: "",
    banner: "",
    marketCap: 5_000,
    floorValue: 0,
    liquidity: 0,
    change24h: 0,
    hooks: {},
    address: TOKEN,
    quoteAsset: "MULTI",
    hookType: "Master",
    bannerGradient: "",
    launchId: 1,
    marketCount: quotes.length,
    markets: quotes.map((quoteAddress, index) => ({
      quoteAddress,
      quoteAsset: `Q${index}`,
      poolId: `0x${String(index + 1).padStart(64, "0")}` as `0x${string}`,
      bps: Math.floor(10_000 / quotes.length),
    })),
  } as TokenPool;
}

type QuoteFn = (
  key: V4PoolKey,
  amountIn: bigint,
  zeroForOne: boolean,
) => bigint | null | Promise<bigint | null>;

function mockClient(keys: V4PoolKey[], quote: QuoteFn): PublicClient {
  return {
    readContract: async () => 1n,
    multicall: async () =>
      keys.map((result) => ({ status: "success", result })),
    simulateContract: async ({ args }: { args: readonly unknown[] }) => {
      const params = args[0] as {
        poolKey: V4PoolKey;
        exactAmount: bigint;
        zeroForOne: boolean;
      };
      const amountOut = await quote(
        params.poolKey,
        params.exactAmount,
        params.zeroForOne,
      );
      if (amountOut == null || amountOut <= 0n) {
        throw new Error("quote failed");
      }
      return { result: [amountOut, 0n] };
    },
  } as unknown as PublicClient;
}

function quoteSide(key: V4PoolKey): Address {
  return key.currency0.toLowerCase() === TOKEN.toLowerCase()
    ? key.currency1
    : key.currency0;
}

function isQuotronBridge(key: V4PoolKey): boolean {
  return key.hooks.toLowerCase() === QUOTRONS_HOOK.toLowerCase();
}

test("deduplicates market quotes and enables aggregation only for multi pools", () => {
  const pool = poolFor([STOCK_A, STOCK_B, STOCK_A]);
  const stockReceive: SwapAsset = {
    key: "stock-a",
    symbol: "STOCKA",
    name: "Stock A",
    address: STOCK_A,
    decimals: 18,
  };
  assert.deepEqual(multiPoolMarketQuotes(pool), [STOCK_A, STOCK_B]);
  assert.equal(shouldAggregateMultiBuy(pool), true);
  assert.equal(shouldAggregateMultiBuy(pool, paymentAssetById("USDC")), true);
  assert.equal(shouldAggregateMultiBuy(pool, paymentAssetById("ETH")), false);
  assert.equal(shouldAggregateMultiSell(pool, STABLE_SWAP_ASSET), true);
  assert.equal(shouldAggregateMultiSell(pool, stockReceive), false);
  assert.equal(shouldAggregateMultiBuy(poolFor([STOCK_A])), false);
});

test("selects a 60/40 split when it beats every full-size route", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    const quote = quoteSide(key);
    if (quote.toLowerCase() === STOCK_A.toLowerCase()) {
      return amount <= 600n ? amount * 3n : amount;
    }
    if (quote.toLowerCase() === STOCK_B.toLowerCase()) {
      return amount <= 400n ? amount * 3n : amount;
    }
    return null;
  });

  const plan = await quoteBestBuyPlan(
    client,
    pool,
    paymentAssetById("USDC"),
    1_000n,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 2);
  assert.equal(plan.legs[0]!.amountIn, 600n);
  assert.equal(plan.legs[1]!.amountIn, 400n);
  assert.equal(plan.amountOut, 3_000n);
  assert.match(plan.routeLabel, /Split 60\/40%/);
});

test("ignores a reverting market and keeps the executable buy leg", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    return quoteSide(key).toLowerCase() === STOCK_A.toLowerCase()
      ? amount * 2n
      : null;
  });

  const plan = await quoteBestBuyPlan(
    client,
    pool,
    paymentAssetById("USDC"),
    1_000n,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.marketQuote, STOCK_A);
  assert.equal(plan.amountOut, 2_000n);
});

test("stock-only aggregation rejects ETH when no ETH-to-stock bridge exists", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], () => {
    throw new Error("ETH route must not be quoted");
  });

  const plan = await quoteBestBuyPlan(
    client,
    pool,
    paymentAssetById("ETH"),
    1_000n,
    TOKEN,
  );
  assert.equal(plan, null);
});

test("sell aggregator picks the highest USDG composite output", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    return quoteSide(key).toLowerCase() === STOCK_A.toLowerCase()
      ? amount * 2n
      : amount * 3n;
  });

  const best = await quoteBestSellRoute(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(best);
  assert.equal(best.kind, "composite");
  assert.equal(best.marketQuote, STOCK_B);
  assert.equal(best.amountOut, 3_000n);
  assert.equal(best.intermediateOut, 3_000n);
});

test("sell aggregator packs live books when no pool can take MAX alone", async () => {
  const stockC = INK_QUOTRON_STOCKS[2]!.address;
  const stockD = INK_QUOTRON_STOCKS[3]!.address;
  const quotes = [STOCK_A, STOCK_B, stockC, stockD];
  const pool = poolFor(quotes);
  const client = mockClient(
    quotes.map(keyFor),
    (key, amount) => {
      if (isQuotronBridge(key)) return amount;
      if (amount > 250n) return null;
      return amount * 2n;
    },
  );

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 4);
  assert.equal(plan.legs.reduce((sum, leg) => sum + leg.amountIn, 0n), 1_000n);
  assert.equal(plan.amountOut, 2_000n);
});

test("sell aggregator keeps a single pool when it beats an equal split", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    return quoteSide(key).toLowerCase() === STOCK_A.toLowerCase()
      ? amount * 2n
      : amount * 3n;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.bestSingle.marketQuote, STOCK_B);
  assert.equal(plan.amountOut, 3_000n);
});

test("USDG sell reuses a full-size stock dump that already quotes", async () => {
  const stockC = INK_QUOTRON_STOCKS[2]!.address;
  const stockD = INK_QUOTRON_STOCKS[3]!.address;
  const quotes = [STOCK_A, STOCK_B, stockC, stockD];
  const pool = poolFor(quotes);
  const client = mockClient(
    quotes.map(keyFor),
    (key, amount) => {
      if (isQuotronBridge(key)) return amount;
      if (quoteSide(key).toLowerCase() !== STOCK_A.toLowerCase()) return null;
      return amount;
    },
  );

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.amountIn, 1_000n);
  assert.equal(plan.amountOut, 1_000n);
  assert.equal(plan.bestSingle.marketQuote, STOCK_A);
});

test("sell aggregator fills MAX across two books that cannot take 100% alone", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    const quote = quoteSide(key);
    if (quote.toLowerCase() === STOCK_A.toLowerCase()) {
      return amount <= 750n ? amount * 2n : null;
    }
    if (quote.toLowerCase() === STOCK_B.toLowerCase()) {
      return amount <= 300n ? amount : null;
    }
    return null;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.reduce((sum, leg) => sum + leg.amountIn, 0n), 1_000n);
  assert.equal(plan.legs.length, 2);
  assert.ok(plan.amountOut > 0n);
});

test("sell aggregator never halves MAX when only a smaller clip would quote", async () => {
  const stockC = INK_QUOTRON_STOCKS[2]!.address;
  const stockD = INK_QUOTRON_STOCKS[3]!.address;
  const quotes = [STOCK_A, STOCK_B, stockC, stockD];
  const pool = poolFor(quotes);
  const client = mockClient(
    quotes.map(keyFor),
    (key, amount) => {
      if (isQuotronBridge(key)) return amount;
      if (quoteSide(key).toLowerCase() !== STOCK_A.toLowerCase()) return null;
      if (amount > 500n) return null;
      return amount;
    },
  );

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.equal(plan, null);
});

test("USDG MAX quotes after a slow hook when the Quotrons hop still fits", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  let hookCalls = 0;
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    if (quoteSide(key).toLowerCase() !== STOCK_A.toLowerCase()) return null;
    hookCalls += 1;
    return new Promise((resolve) => {
      setTimeout(() => resolve(amount), 2_800);
    });
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.amountIn, 1_000n);
  assert.equal(plan.amountOut, 1_000n);
  assert.equal(hookCalls, 1);
});

test("MAX USDG keeps 100% on the live book when dead pools hang", async () => {
  const stockC = INK_QUOTRON_STOCKS[2]!.address;
  const stockD = INK_QUOTRON_STOCKS[3]!.address;
  const quotes = [STOCK_A, STOCK_B, stockC, stockD];
  const pool = poolFor(quotes);
  const client = mockClient(
    quotes.map(keyFor),
    (key, amount) => {
      if (isQuotronBridge(key)) return amount;
      if (quoteSide(key).toLowerCase() !== STOCK_A.toLowerCase()) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(null), INDIVIDUAL_LEG_TIMEOUT_MS + 250);
        });
      }
      return amount;
    },
  );

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.amountIn, 1_000n);
  assert.equal(plan.amountOut, 1_000n);
  assert.equal(plan.bestSingle.marketQuote, STOCK_A);
  assert.equal(plan.bestSingle.marketIndex, 0);
});

test("sell aggregator keeps the single route when a split only ties", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    return amount;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.amountIn, 1_000n);
  assert.equal(plan.amountOut, 1_000n);
});

test("splits when a split produces more USDG even by a little", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    const quote = quoteSide(key);
    if (quote.toLowerCase() === STOCK_B.toLowerCase() && amount <= 4_000n) {
      return amount + 29n;
    }
    return amount;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    10_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 2);
  assert.ok(plan.amountOut > 10_000n);
});

test("sell aggregator splits when smaller clips beat a single dump", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) return amount;
    const quote = quoteSide(key);
    if (quote.toLowerCase() === STOCK_A.toLowerCase()) {
      return amount <= 600n ? amount * 3n : amount;
    }
    if (quote.toLowerCase() === STOCK_B.toLowerCase()) {
      return amount <= 400n ? amount * 3n : amount;
    }
    return null;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 2);
  assert.equal(plan.legs[0]!.amountIn, 600n);
  assert.equal(plan.legs[1]!.amountIn, 400n);
  assert.equal(plan.amountOut, 3_000n);
  assert.match(plan.routeLabel, /Split 60\/40%/);
});

test("sell aggregator uses a direct market when receiving that quote", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const receive: SwapAsset = {
    key: "stock-a",
    symbol: "STOCKA",
    name: "Stock A",
    address: STOCK_A,
    decimals: 18,
  };
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (key.hooks === zeroAddress) return null;
    return quoteSide(key).toLowerCase() === STOCK_A.toLowerCase()
      ? amount * 2n
      : amount * 3n;
  });

  const best = await quoteBestSellRoute(client, pool, 1_000n, receive, TOKEN);

  assert.ok(best);
  assert.equal(best.kind, "direct");
  assert.equal(best.marketQuote, STOCK_A);
  assert.equal(best.amountOut, 2_000n);
});

test("USDG MAX still quotes when only wAAPL's hook dump works and the Quoter hop uses slot0", async () => {
  const stockC = INK_QUOTRON_STOCKS[2]!.address;
  const stockD = INK_QUOTRON_STOCKS[3]!.address;
  const quotes = [STOCK_A, STOCK_B, stockC, stockD];
  const pool = poolFor(quotes);
  let aaplHook = 0;
  const client = {
    readContract: async ({ functionName }: { functionName?: string }) => {
      if (functionName === "getSlot0") return [2n ** 96n, 0, 0, 0];
      return 1n;
    },
    multicall: async () => quotes.map((q) => ({ status: "success" as const, result: keyFor(q) })),
    simulateContract: async ({ args }: { args: readonly unknown[] }) => {
      const params = args[0] as {
        poolKey: V4PoolKey;
        exactAmount: bigint;
      };
      if (isQuotronBridge(params.poolKey)) {
        throw new Error("tick walk");
      }
      if (quoteSide(params.poolKey).toLowerCase() !== STOCK_A.toLowerCase()) {
        throw new Error("empty book");
      }
      aaplHook += 1;
      return { result: [params.exactAmount, 0n] };
    },
  } as unknown as PublicClient;

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0]!.amountIn, 1_000n);
  assert.equal(plan.amountOut, 1_000n);
  assert.equal(plan.bestSingle.marketQuote, STOCK_A);
  assert.equal(plan.bestSingle.kind, "composite");
  assert.equal(aaplHook, 1);
  if (plan.bestSingle.kind === "composite") {
    assert.equal(plan.bestSingle.estimated, true);
  }
});

test("secondary pool throws do not cancel a live wAAPL USDG route", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient([keyFor(STOCK_A), keyFor(STOCK_B)], (key, amount) => {
    if (isQuotronBridge(key)) {
      if (quoteSide(key).toLowerCase() === STOCK_B.toLowerCase()) {
        throw new Error("RPC saturated");
      }
      return amount;
    }
    if (quoteSide(key).toLowerCase() === STOCK_B.toLowerCase()) {
      throw new Error("empty AMZN");
    }
    return amount * 2n;
  });

  const plan = await quoteBestSellPlan(
    client,
    pool,
    1_000n,
    STABLE_SWAP_ASSET,
    TOKEN,
  );

  assert.ok(plan);
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.bestSingle.marketQuote, STOCK_A);
  assert.equal(plan.amountOut, 2_000n);
});

test("returns null when no market or bridge can produce output", async () => {
  const pool = poolFor([STOCK_A, STOCK_B]);
  const client = mockClient(
    [keyFor(STOCK_A), keyFor(STOCK_B)],
    () => null,
  );

  assert.equal(
    await quoteBestBuyPlan(
      client,
      pool,
      paymentAssetById("USDC"),
      1_000n,
      TOKEN,
    ),
    null,
  );
  assert.equal(
    await quoteBestSellRoute(
      client,
      pool,
      1_000n,
      NATIVE_ETH_ASSET,
      TOKEN,
    ),
    null,
  );
});
