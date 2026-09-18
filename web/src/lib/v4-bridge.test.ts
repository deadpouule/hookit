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
  TOKEN_AND_WSTOCK_DECIMALS,
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
