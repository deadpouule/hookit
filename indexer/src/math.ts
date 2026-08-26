/** Spot quote per 1 whole token (18 decimals) from Uniswap v4 sqrtPriceX96. */
export function quotePerToken(sqrtPriceX96: bigint, tokenIsCurrency0: boolean): number {
  if (sqrtPriceX96 === 0n) return 0;
  const Q96 = 2n ** 96n;
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  const tokenPerQuote = Number(priceX192) / Number(Q96 * Q96);
  if (tokenIsCurrency0) return tokenPerQuote > 0 ? tokenPerQuote : 0;
  return tokenPerQuote > 0 ? 1 / tokenPerQuote : 0;
}

export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}
