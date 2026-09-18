import assert from "node:assert/strict";
import test from "node:test";

import { type Address, type PublicClient } from "viem";

import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import {
  currencyDecimalsForBridge,
  findBridgeRoute,
  QUOTRONS_V4_FEE,
  QUOTRONS_V4_TICK_SPACING,
  quotronKeyForStock,
  quotronZeroForOne,
  spotExactInFromSqrt,
  TOKEN_AND_WSTOCK_DECIMALS,
  UINT128_MAX,
  USDG_DECIMALS,
} from "@/lib/v4-bridge";
import { INK_QUOTRON_STOCKS, QUOTRONS_HOOK } from "@/lib/xstocks";

const STOCK = INK_QUOTRON_STOCKS[0]!.address;
const USDG = STABLE_QUOTE_ADDRESS;

test("Quotrons PoolKey sorts currencies, sets dynamic fee 0x800000 and tickSpacing 60", () => {
  const key = quotronKeyForStock(STOCK, USDG);
  assert.ok(key);
  assert.equal(key.fee, QUOTRONS_V4_FEE);
  assert.equal(key.fee, 0x800000);
  assert.equal(key.tickSpacing, QUOTRONS_V4_TICK_SPACING);
  assert.equal(key.hooks.toLowerCase(), QUOTRONS_HOOK.toLowerCase());
  assert.ok(BigInt(key.currency0) < BigInt(key.currency1));
  const [lo, hi] =
    BigInt(STOCK) < BigInt(USDG) ? [STOCK, USDG] : [USDG, STOCK];
  assert.equal(key.currency0.toLowerCase(), lo.toLowerCase());
  assert.equal(key.currency1.toLowerCase(), hi.toLowerCase());
});

test("zeroForOne follows lexical wStock vs USDG order", () => {
  assert.equal(
    quotronZeroForOne(STOCK, STOCK, USDG),
    BigInt(STOCK) < BigInt(USDG),
  );
  assert.equal(
    quotronZeroForOne(USDG, STOCK, USDG),
    BigInt(USDG) < BigInt(STOCK),
  );
});

test("USDG is 6 decimals; token and wStock are 18", () => {
  assert.equal(currencyDecimalsForBridge(USDG), USDG_DECIMALS);
  assert.equal(currencyDecimalsForBridge(STOCK), TOKEN_AND_WSTOCK_DECIMALS);
  assert.equal(USDG_DECIMALS, 6);
  assert.equal(TOKEN_AND_WSTOCK_DECIMALS, 18);
});

test("findBridgeRoute uses the canonical Quotrons key when selling wStock for USDG", async () => {
  let calls = 0;
  let capturedFee: number | undefined;
  let capturedTick: number | undefined;
  let capturedZeroForOne: boolean | undefined;
  let capturedHooks: Address | undefined;
  const client = {
    simulateContract: async ({ args }: { args: readonly unknown[] }) => {
      calls += 1;
      const params = args[0] as {
        poolKey: {
          fee: number;
          tickSpacing: number;
          hooks: Address;
          currency0: Address;
          currency1: Address;
        };
        zeroForOne: boolean;
      };
      capturedFee = params.poolKey.fee;
      capturedTick = params.poolKey.tickSpacing;
      capturedZeroForOne = params.zeroForOne;
      capturedHooks = params.poolKey.hooks;
      assert.ok(BigInt(params.poolKey.currency0) < BigInt(params.poolKey.currency1));
      return { result: [70n, 0n] };
    },
  } as unknown as PublicClient;

  const route = await findBridgeRoute(client, STOCK, USDG, 1_000n);
  assert.ok(route);
  assert.equal(calls, 1);
  assert.equal(capturedFee, 0x800000);
  assert.equal(capturedTick, 60);
  assert.equal(capturedHooks?.toLowerCase(), QUOTRONS_HOOK.toLowerCase());
  assert.equal(capturedZeroForOne, BigInt(STOCK) < BigInt(USDG));
  assert.equal(route.amountOut, 70n);
});

test("listed Quotrons stocks do not fall through to uncapped generic pools", async () => {
  let calls = 0;
  const client = {
    simulateContract: async () => {
      calls += 1;
      throw new Error("PoolNotInitialized");
    },
  } as unknown as PublicClient;

  const route = await findBridgeRoute(client, STOCK, USDG, 1_000n);
  assert.equal(route, null);
  assert.equal(calls, 1);
});

test("spotExactInFromSqrt is 1:1 when sqrtPriceX96 is 2^96", () => {
  const sqrt = 2n ** 96n;
  assert.equal(spotExactInFromSqrt(1_000n, sqrt, true), 1_000n);
  assert.equal(spotExactInFromSqrt(1_000n, sqrt, false), 1_000n);
  assert.equal(spotExactInFromSqrt(0n, sqrt, true), 0n);
});

test("findBridgeRoute falls back to slot0 when the Quoter reverts on a large size", async () => {
  let quoterCalls = 0;
  let slotCalls = 0;
  const client = {
    simulateContract: async () => {
      quoterCalls += 1;
      throw new Error("UnexpectedCall");
    },
    readContract: async ({ functionName }: { functionName: string }) => {
      assert.equal(functionName, "getSlot0");
      slotCalls += 1;
      return [2n ** 96n, 0, 0, 0];
    },
  } as unknown as PublicClient;

  const route = await findBridgeRoute(client, STOCK, USDG, 10_000n);
  assert.ok(route);
  assert.equal(route.estimated, true);
  assert.equal(route.amountOut, 10_000n);
  assert.equal(quoterCalls, 1);
  assert.ok(slotCalls >= 1);
  assert.equal(route.key.fee, 0x800000);
  assert.equal(route.key.tickSpacing, 60);
});

test("findBridgeRoute skips the Quoter when amountIn exceeds uint128 and uses slot0", async () => {
  let quoterCalls = 0;
  const client = {
    simulateContract: async () => {
      quoterCalls += 1;
      throw new Error("should not quote uint128 overflow");
    },
    readContract: async () => [2n ** 96n, 0, 0, 0],
  } as unknown as PublicClient;

  const amountIn = UINT128_MAX + 1n;
  const route = await findBridgeRoute(client, STOCK, USDG, amountIn);
  assert.ok(route);
  assert.equal(route.estimated, true);
  assert.equal(route.amountOut, amountIn);
  assert.equal(quoterCalls, 0);
});
