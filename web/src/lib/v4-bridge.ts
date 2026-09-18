import { encodeAbiParameters, type Address, type Hex, type PublicClient, zeroAddress } from "viem";

import {
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  STABLE_QUOTE_ADDRESS,
  STATE_VIEW_ADDRESS,
  V4_QUOTER_ADDRESS,
} from "@/lib/contracts/config";
import { v4QuoterAbi } from "@/lib/contracts/swap-abi";
import { sortV4Currencies, type PaymentAsset } from "@/lib/payment-assets";
import { poolIdFromKey, type V4PoolKey } from "@/lib/pool-key";
import { stateViewAbi } from "@/lib/pool-price";
import {
  INK_QUOTRON_STOCKS,
  QUOTRONS_DYNAMIC_FEE,
  QUOTRONS_HOOK,
  type QuotronStockListing,
} from "@/lib/xstocks";

const ZERO_HOOKS = "0x0000000000000000000000000000000000000000" as Address;
/** Isolated Uniswap V4 quoter budget. Illiquid Quotrons books return 0 instead of hanging RPC. */
const BRIDGE_QUOTE_TIMEOUT_MS = 3_000;
/** Uniswap V4 `uint128` exact-in cap. Larger MAX dumps skip the Quoter and use slot0. */
export const UINT128_MAX = (1n << 128n) - 1n;
const Q96 = 2n ** 96n;
/** Uniswap V4 dynamic-fee flag used by every Quotrons wStock/USDG pool. */
export const QUOTRONS_V4_FEE = QUOTRONS_DYNAMIC_FEE;
export const QUOTRONS_V4_TICK_SPACING = 60;
export const USDG_DECIMALS = 6;
export const TOKEN_AND_WSTOCK_DECIMALS = 18;

const BRIDGE_CANDIDATES: { fee: number; tickSpacing: number }[] = [
  { fee: 0, tickSpacing: 60 },
  { fee: QUOTRONS_DYNAMIC_FEE, tickSpacing: QUOTRONS_V4_TICK_SPACING },
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 500, tickSpacing: 50 },
];

export type BridgeRoute = {
  key: V4PoolKey;
  zeroForOne: boolean;
  amountOut: bigint;
  /** True when slot0 sqrtPriceX96 was used because the on-chain Quoter failed. */
  estimated?: boolean;
};

export type BridgeAmountOut = {
  amountOut: bigint;
  routeLabel?: string;
};

export function quotronKeyForStock(stock: Address, usdg: Address): V4PoolKey | null {
  const listing = INK_QUOTRON_STOCKS.find((s) => s.address.toLowerCase() === stock.toLowerCase());
  if (!listing) return null;
  const [currency0, currency1] = sortV4Currencies(stock, usdg);
  return {
    currency0,
    currency1,
    fee: QUOTRONS_V4_FEE,
    tickSpacing: QUOTRONS_V4_TICK_SPACING,
    hooks: QUOTRONS_HOOK,
  };
}

/** Uniswap V4 `zeroForOne` for a Quotrons wStock/USDG hop. */
export function quotronZeroForOne(currencyIn: Address, wStock: Address, usdg: Address): boolean {
  const sellingStock = currencyIn.toLowerCase() === wStock.toLowerCase();
  return sellingStock ? BigInt(wStock) < BigInt(usdg) : BigInt(usdg) < BigInt(wStock);
}

export function currencyDecimalsForBridge(currency: Address): number {
  return currency.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()
    ? USDG_DECIMALS
    : TOKEN_AND_WSTOCK_DECIMALS;
}

/**
 * Deterministic exact-in conversion from Uniswap V4 `sqrtPriceX96`.
 * `zeroForOne` sells currency0 for currency1.
 */
export function spotExactInFromSqrt(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  zeroForOne: boolean,
): bigint {
  if (amountIn <= 0n || sqrtPriceX96 <= 0n) return 0n;
  try {
    if (zeroForOne) {
      const step = (amountIn * sqrtPriceX96) / Q96;
      return (step * sqrtPriceX96) / Q96;
    }
    const priceX192 = sqrtPriceX96 * sqrtPriceX96;
    if (priceX192 === 0n) return 0n;
    return (amountIn * Q96 * Q96) / priceX192;
  } catch {
    return 0n;
  }
}

function slot0SqrtFromResult(raw: unknown): bigint | null {
  if (raw == null) return null;
  // A lone bigint is not a StateView tuple (tests stub readContract with 1n).
  if (typeof raw === "bigint") return null;
  if (Array.isArray(raw)) {
    const sqrt = raw[0];
    return typeof sqrt === "bigint" && sqrt > 0n ? sqrt : null;
  }
  if (typeof raw === "object") {
    const rec = raw as { sqrtPriceX96?: unknown; 0?: unknown };
    const sqrt = rec.sqrtPriceX96 ?? rec[0];
    return typeof sqrt === "bigint" && sqrt > 0n ? sqrt : null;
  }
  return null;
}

async function readQuotronSlot0Sqrt(
  client: PublicClient,
  key: V4PoolKey,
  listing: QuotronStockListing,
): Promise<bigint | null> {
  const ids = [poolIdFromKey(key)];
  if (listing.quotronPoolId.toLowerCase() !== ids[0]!.toLowerCase()) {
    ids.push(listing.quotronPoolId);
  }
  for (const poolId of ids) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raced = await Promise.race([
        client
          .readContract({
            address: STATE_VIEW_ADDRESS,
            abi: stateViewAbi,
            functionName: "getSlot0",
            args: [poolId],
          })
          .then((value) => value, () => null),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), BRIDGE_QUOTE_TIMEOUT_MS);
        }),
      ]);
      const sqrt = slot0SqrtFromResult(raced);
      if (sqrt) return sqrt;
    } catch {
      // Dead or uninitialized books stay at 0 so sibling legs can still quote.
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return null;
}

async function quoteBridge(
  client: PublicClient,
  key: V4PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
): Promise<bigint | null> {
  if (amountIn <= 0n || amountIn > UINT128_MAX) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const quoted = client.simulateContract({
      address: V4_QUOTER_ADDRESS,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: key,
          zeroForOne,
          exactAmount: amountIn,
          hookData: "0x" as Hex,
        },
      ],
    });
    const raced = await Promise.race([
      quoted.then((value) => value, () => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), BRIDGE_QUOTE_TIMEOUT_MS);
      }),
    ]);
    if (!raced) return null;
    const amountOut = raced.result[0] as bigint;
    return amountOut > BigInt(0) ? amountOut : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function bridgeRouteLabel(currencyIn: Address, currencyOut: Address): string {
  const inLabel =
    currencyIn === zeroAddress ? "ETH" : `${currencyIn.slice(0, 6)}…${currencyIn.slice(-4)}`;
  const outLabel =
    currencyOut === zeroAddress ? "ETH" : `${currencyOut.slice(0, 6)}…${currencyOut.slice(-4)}`;
  return `${inLabel} → ${outLabel}`;
}

export async function findBridgeRoute(
  client: PublicClient,
  currencyIn: Address,
  currencyOut: Address,
  amountIn: bigint,
): Promise<BridgeRoute | null> {
  if (amountIn <= BigInt(0)) return null;
  if (currencyIn.toLowerCase() === currencyOut.toLowerCase()) {
    return {
      key: {
        currency0: sortV4Currencies(currencyIn, currencyOut)[0],
        currency1: sortV4Currencies(currencyIn, currencyOut)[1],
        fee: 0,
        tickSpacing: 60,
        hooks: ZERO_HOOKS,
      },
      zeroForOne: false,
      amountOut: amountIn,
    };
  }

  const usdg = STABLE_QUOTE_ADDRESS;
  const inIsUsdg = currencyIn.toLowerCase() === usdg.toLowerCase();
  const outIsUsdg = currencyOut.toLowerCase() === usdg.toLowerCase();
  const stock = inIsUsdg ? currencyOut : outIsUsdg ? currencyIn : null;

  // Prefer Quotrons wStock/USDG markets when either leg is USDG and the other is a wrapped equity.
  // Listed stocks use the canonical PoolKey only — never fall through to uncapped generic pools.
  if (stock) {
    const listing = INK_QUOTRON_STOCKS.find(
      (s) => s.address.toLowerCase() === stock.toLowerCase(),
    );
    const key = listing ? quotronKeyForStock(stock, usdg) : null;
    if (listing && key) {
      const zeroForOne = quotronZeroForOne(currencyIn, stock, usdg);
      const amountOut = await quoteBridge(client, key, zeroForOne, amountIn);
      if (amountOut != null) {
        return { key, zeroForOne, amountOut };
      }
      // MAX dumps can revert the V4 Quoter (tick walk / uint128). Spot from
      // slot0 still lets the UI show a quote instead of "No safe route".
      const sqrt = await readQuotronSlot0Sqrt(client, key, listing);
      if (sqrt) {
        const spotOut = spotExactInFromSqrt(amountIn, sqrt, zeroForOne);
        if (spotOut > 0n) {
          return { key, zeroForOne, amountOut: spotOut, estimated: true };
        }
      }
      return null;
    }
  }

  const [currency0, currency1] = sortV4Currencies(currencyIn, currencyOut);
  const zeroForOne = currencyIn.toLowerCase() === currency0.toLowerCase();

  let best: BridgeRoute | null = null;
  for (const { fee, tickSpacing } of BRIDGE_CANDIDATES) {
    const key: V4PoolKey = { currency0, currency1, fee, tickSpacing, hooks: ZERO_HOOKS };
    const amountOut = await quoteBridge(client, key, zeroForOne, amountIn);
    if (amountOut != null && (!best || amountOut > best.amountOut)) {
      best = { key, zeroForOne, amountOut };
    }
  }
  return best;
}

/** Quote bridge output, including a 2-hop fallback via USDG when direct route fails. */
export async function findBridgeAmountOut(
  client: PublicClient,
  currencyIn: Address,
  currencyOut: Address,
  amountIn: bigint,
): Promise<BridgeAmountOut | null> {
  if (amountIn <= BigInt(0)) return null;

  const direct = await findBridgeRoute(client, currencyIn, currencyOut, amountIn);
  if (direct) {
    return {
      amountOut: direct.amountOut,
      routeLabel: bridgeRouteLabel(currencyIn, currencyOut),
    };
  }

  const usdg = STABLE_QUOTE_ADDRESS;
  const inLower = currencyIn.toLowerCase();
  const outLower = currencyOut.toLowerCase();
  if (inLower === usdg.toLowerCase() || outLower === usdg.toLowerCase()) {
    return null;
  }

  const hop1 = await findBridgeRoute(client, currencyIn, usdg, amountIn);
  if (!hop1) return null;
  const hop2 = await findBridgeRoute(client, usdg, currencyOut, hop1.amountOut);
  if (!hop2) return null;

  return {
    amountOut: hop2.amountOut,
    routeLabel: `${bridgeRouteLabel(currencyIn, usdg)} → ${bridgeRouteLabel(usdg, currencyOut)}`,
  };
}

export function hookSwapDirection(poolKey: V4PoolKey, token: Address, side: "buy" | "sell"): boolean {
  const tokenIs0 = token.toLowerCase() === poolKey.currency0.toLowerCase();
  return side === "buy" ? !tokenIs0 : tokenIs0;
}

export function hookRecipientData(recipient: Address): Hex {
  return encodeAbiParameters([{ type: "address" }], [recipient]);
}

export function sqrtLimit(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE + BigInt(1) : MAX_SQRT_PRICE - BigInt(1);
}

export function paymentMatchesPoolQuote(payment: PaymentAsset, poolQuote: Address): boolean {
  return payment.address.toLowerCase() === poolQuote.toLowerCase();
}

export function isNative(currency: Address): boolean {
  return currency === zeroAddress;
}
