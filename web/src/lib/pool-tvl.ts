/**
 * Uniswap v4 position TVL helpers — convert raw L + ticks + sqrtPrice → USD.
 */

const Q96 = 2n ** 96n;
const MAX_UINT256 = (1n << 256n) - 1n;

const TICK_ABS_BITS: readonly bigint[] = [
  0xfffcb933bd6fad37aa2d162d1a594001n,
  0xfff97272373d413259a46990580e213an,
  0xfff2e50f5f656932ef12357cf3c7fdccn,
  0xffe5caca7e10e4e61c3624eaa0941cd0n,
  0xffcb9843d60f6159c9db58835c926644n,
  0xff973b41fa98c081472e6896dfb254c0n,
  0xff2ea16466c96a3843ec78b326b52861n,
  0xfe5dee046a99a2a811c461f1969c3053n,
  0xfcbe86c7900a88aedcffc83b479aa3a4n,
  0xf987a7253ac413176f2b074cf7815e54n,
  0xf3392b0822b70005940c7a398e4b70f3n,
  0xe7159475a2c29b7443b29c7fa6e889d9n,
  0xd097f3bdfd2022b8845ad8f792aa5825n,
  0xa9f746462d870fdf8a65dc1f90e061e5n,
  0x70d869a156d2a1b890bb3df62baf32f7n,
  0x31be135f97d08fd981231505542fcfa6n,
  0x9aa508b5b7a84e1c677de54f3e99bc9n,
  0x5d6af8dedb81196699c329225ee604n,
  0x2216e584f5fa1ea926041bedfe98n,
  0x48a170391f7dc42444e8fa2n,
];

/** Port of TickMath.getSqrtPriceAtTick (Q64.96). */
export function getSqrtPriceAtTick(tick: number): bigint {
  const absTick = tick < 0 ? -tick : tick;
  if (absTick > 887272) throw new Error(`tick out of range: ${tick}`);

  let price = (absTick & 0x1) !== 0 ? TICK_ABS_BITS[0]! : 1n << 128n;
  for (let i = 1; i < TICK_ABS_BITS.length; i += 1) {
    if ((absTick & (1 << i)) !== 0) {
      price = (price * TICK_ABS_BITS[i]!) >> 128n;
    }
  }
  if (tick > 0) price = MAX_UINT256 / price;
  // Q128.128 → Q64.96, round up
  return (price + ((1n << 32n) - 1n)) >> 32n;
}

function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  if (denom === 0n) return 0n;
  return (a * b) / denom;
}

export function getAmount0ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  let a = sqrtA;
  let b = sqrtB;
  if (a > b) [a, b] = [b, a];
  if (a === 0n) return 0n;
  // liquidity * (sqrtB - sqrtA) / sqrtB / sqrtA * Q96
  return mulDiv(liquidity << 96n, b - a, b) / a;
}

export function getAmount1ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  let a = sqrtA;
  let b = sqrtB;
  if (a > b) [a, b] = [b, a];
  return mulDiv(liquidity, b - a, Q96);
}

export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };
  const sqrtA = getSqrtPriceAtTick(tickLower);
  const sqrtB = getSqrtPriceAtTick(tickUpper);

  if (sqrtPriceX96 <= sqrtA) {
    return { amount0: getAmount0ForLiquidity(sqrtA, sqrtB, liquidity), amount1: 0n };
  }
  if (sqrtPriceX96 >= sqrtB) {
    return { amount0: 0n, amount1: getAmount1ForLiquidity(sqrtA, sqrtB, liquidity) };
  }
  return {
    amount0: getAmount0ForLiquidity(sqrtPriceX96, sqrtB, liquidity),
    amount1: getAmount1ForLiquidity(sqrtA, sqrtPriceX96, liquidity),
  };
}

export type TvlInput = {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  tokenIsCurrency0: boolean;
  /** Quote is native ETH (18 decimals). */
  quoteIsEth: boolean;
  ethUsd: number;
  /** USD value of one quote unit (1 ETH, 1 USDG, or 1 wStock). */
  quoteUsdPerUnit?: number;
  /** Quote token decimals when not ETH (e.g. 6 for USDG). */
  quoteDecimals?: number;
};

/**
 * Pool TVL in USD = quote reserves (USD) + token reserves × spot.
 * For Hookit unilateral seed positions this ≈ FDV until meaningful quote enters.
 */
export function poolTvlUsd(input: TvlInput): number {
  const {
    sqrtPriceX96,
    liquidity,
    tickLower,
    tickUpper,
    tokenIsCurrency0,
    quoteIsEth,
    ethUsd,
    quoteUsdPerUnit,
    quoteDecimals = 6,
  } = input;
  if (liquidity === 0n || sqrtPriceX96 === 0n) return 0;

  const quoteUsd = quoteIsEth ? ethUsd : (quoteUsdPerUnit ?? 1);

  const { amount0, amount1 } = getAmountsForLiquidity(
    sqrtPriceX96,
    tickLower,
    tickUpper,
    liquidity,
  );

  const tokenWei = tokenIsCurrency0 ? amount0 : amount1;
  const quoteWei = tokenIsCurrency0 ? amount1 : amount0;

  // Spot: ETH (or quote) per 1 whole token.
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  const token1PerToken0 = Number(priceX192) / Number(Q96 * Q96);
  const ethPerToken = tokenIsCurrency0
    ? token1PerToken0
    : token1PerToken0 > 0
      ? 1 / token1PerToken0
      : 0;

  const tokens = Number(tokenWei) / 1e18;
  const quoteHuman = Number(quoteWei) / (quoteIsEth ? 1e18 : 10 ** quoteDecimals);

  const tokenUsd = tokens * ethPerToken * quoteUsd;
  const quoteUsdReserve = quoteHuman * quoteUsd;

  return Math.max(0, tokenUsd + quoteUsdReserve);
}
