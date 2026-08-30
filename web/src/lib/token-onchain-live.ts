import {
  type Address,
  decodeEventLog,
  parseAbiItem,
  zeroAddress,
} from "viem";
import type { PublicClient } from "viem";

import { POOL_MANAGER_ADDRESS, getChainDeployment } from "@/lib/contracts/config";
import { ethPerTokenFromSqrtPrice, stateViewAbi } from "@/lib/pool-price";
import { poolTvlUsd } from "@/lib/pool-tvl";
import {
  marketCapUsdForPool,
  quoteVolumeUsd,
  resolveQuoteKind,
} from "@/lib/quote-usd";
import { TOTAL_SUPPLY, type LiveCandle, type LiveSwap, type LiveTokenState } from "@/lib/token-live";
import type { TokenPool } from "@/lib/types";

const LOOKBACK_BLOCKS = 8_000n;
const LOG_CHUNK = 2_000n;

const swapEvent = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);

export type OnChainLivePayload = {
  source: "onchain";
  live: LiveTokenState;
};

function abs(n: bigint) {
  return n < BigInt(0) ? -n : n;
}

function seriesToCandles(mcapSeries: number[]): LiveCandle[] {
  if (mcapSeries.length === 0) return [];
  const candles: LiveCandle[] = [];
  const bucket = Math.max(1, Math.floor(mcapSeries.length / 48));
  for (let i = 0; i < mcapSeries.length; i += bucket) {
    const slice = mcapSeries.slice(i, i + bucket);
    const o = slice[0]!;
    const c = slice[slice.length - 1]!;
    candles.push({
      o,
      c,
      h: Math.max(...slice),
      l: Math.min(...slice),
    });
  }
  return candles;
}

/** Spot-only live state — `pool.liquidity` must already be TVL USD when enriched. */
export function buildSparseLive(pool: TokenPool, ethUsd: number): LiveTokenState {
  const priceEth = pool.priceEth ?? 0;
  const quoteUsd = pool.quoteUsd;
  const launchMcapQuoteHuman = pool.launchMcapQuoteHuman;
  const marketCap =
    pool.marketCap > 0
      ? pool.marketCap
      : priceEth > 0
        ? marketCapUsdForPool(priceEth, pool, ethUsd, quoteUsd, launchMcapQuoteHuman)
        : 0;
  const priceUsd = marketCap > 0 ? marketCap / TOTAL_SUPPLY : 0;
  const spotCandle =
    marketCap > 0
      ? [{ o: marketCap, h: marketCap, l: marketCap, c: marketCap }]
      : [];

  return {
    priceUsd,
    marketCap,
    volume24h: pool.volume24h ?? 0,
    liquidity: pool.liquidity > 0 ? pool.liquidity : marketCap,
    holders: 0,
    txns: pool.trades24h ?? 0,
    change5m: 0,
    change1h: 0,
    change6h: 0,
    change24h: pool.change24h ?? 0,
    buyPct: 50,
    candles: spotCandle,
    swaps: [],
    holderRows: [],
  };
}

export async function fetchOnChainLive(
  client: PublicClient,
  pool: TokenPool,
  ethUsd: number,
): Promise<OnChainLivePayload> {
  const base = buildSparseLive(pool, ethUsd);
  if (!pool.poolId) {
    return { source: "onchain", live: base };
  }

  const poolId = pool.poolId;
  const tokenIs0 = pool.tokenIsCurrency0 ?? false;
  const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  const quoteIsEth = quoteKind === "eth";
  const quoteUsd = pool.quoteUsd;
  const launchMcapQuoteHuman = pool.launchMcapQuoteHuman;
  const stateView = getChainDeployment().stateView;

  const latest = await client.getBlockNumber();
  const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : BigInt(0);

  const [slot0, liveL, logs] = await Promise.all([
    client
      .readContract({
        address: stateView,
        abi: stateViewAbi,
        functionName: "getSlot0",
        args: [poolId],
      })
      .catch(() => null),
    client
      .readContract({
        address: stateView,
        abi: stateViewAbi,
        functionName: "getLiquidity",
        args: [poolId],
      })
      .catch(() => BigInt(pool.liquidityRaw ?? "0")),
    (async () => {
      const out: Awaited<ReturnType<typeof client.getLogs>> = [];
      for (let start = fromBlock; start <= latest; start += LOG_CHUNK) {
        const end = start + LOG_CHUNK - BigInt(1) > latest ? latest : start + LOG_CHUNK - BigInt(1);
        const chunk = await client.getLogs({
          address: POOL_MANAGER_ADDRESS,
          event: swapEvent,
          args: { id: poolId },
          fromBlock: start,
          toBlock: end,
        });
        out.push(...chunk);
      }
      return out;
    })(),
  ]);

  let spotEth = pool.priceEth ?? 0;
  let sqrtPriceX96 = 0n;
  if (slot0) {
    const [sqrt] = slot0 as readonly [bigint, number, number, number];
    sqrtPriceX96 = sqrt;
    spotEth = ethPerTokenFromSqrtPrice(sqrt, tokenIs0);
  }

  const marketCap =
    spotEth > 0
      ? marketCapUsdForPool(spotEth, pool, ethUsd, quoteUsd, launchMcapQuoteHuman)
      : base.marketCap;
  const priceUsd = marketCap / TOTAL_SUPPLY;

  const liquidity =
    pool.tickLower != null &&
    pool.tickUpper != null &&
    sqrtPriceX96 > 0n &&
    (liveL as bigint) > 0n
      ? poolTvlUsd({
          sqrtPriceX96,
          liquidity: liveL as bigint,
          tickLower: pool.tickLower,
          tickUpper: pool.tickUpper,
          tokenIsCurrency0: tokenIs0,
          quoteIsEth,
          ethUsd,
          quoteUsdPerUnit: quoteUsd,
        })
      : pool.liquidity > 0
        ? pool.liquidity
        : marketCap;

  const mcapSeries: number[] = [];
  const swaps: LiveSwap[] = [];
  let volumeQuoteWei = BigInt(0);
  let buys = 0;

  const decoded = logs
    .map((log) => {
      try {
        const { args } = decodeEventLog({
          abi: [swapEvent],
          data: log.data,
          topics: log.topics,
        });
        const a = args as {
          sender: Address;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
        };
        return { log, args: a };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const recent = decoded.slice(-40);
  const blockNums = [...new Set(recent.map((r) => Number(r.log.blockNumber ?? 0)))];
  const blocks = await Promise.all(
    blockNums.slice(-20).map((n) =>
      client.getBlock({ blockNumber: BigInt(n) }).catch(() => null),
    ),
  );
  const tsByBlock = new Map<number, number>();
  blockNums.slice(-20).forEach((n, i) => {
    const b = blocks[i];
    if (b) tsByBlock.set(n, Number(b.timestamp));
  });
  const now = Math.floor(Date.now() / 1000);

  for (const { log, args } of decoded) {
    const quoteDelta = tokenIs0 ? args.amount1 : args.amount0;
    const tokenDelta = tokenIs0 ? args.amount0 : args.amount1;
    volumeQuoteWei += abs(quoteDelta);
    const price = ethPerTokenFromSqrtPrice(args.sqrtPriceX96, tokenIs0);
    const mcap =
      price > 0
        ? marketCapUsdForPool(price, pool, ethUsd, quoteUsd, launchMcapQuoteHuman)
        : marketCap;

    if (mcap > 0) mcapSeries.push(mcap);

    const side: "buy" | "sell" = quoteDelta > BigInt(0) ? "buy" : "sell";
    if (side === "buy") buys += 1;

    const totalUsd = quoteVolumeUsd(abs(quoteDelta), pool, ethUsd, quoteUsd);
    const tokenAmt = Number(abs(tokenDelta)) / 1e18;
    const bn = Number(log.blockNumber ?? 0);
    const ts = tsByBlock.get(bn);
    const ageSec = ts != null ? Math.max(0, now - ts) : Math.max(0, Number(latest - BigInt(bn)) * 2);

    swaps.push({
      id: `${log.transactionHash ?? "0x"}-${log.logIndex ?? 0}`,
      ageSec,
      recipient: args.sender
        ? `${args.sender.slice(0, 6)}…${args.sender.slice(-4)}`
        : "—",
      side,
      amount: tokenAmt,
      totalUsd,
      marketCap: mcap,
    });
  }

  swaps.reverse();
  const candles =
    mcapSeries.length > 0
      ? seriesToCandles(mcapSeries)
      : marketCap > 0
        ? [{ o: marketCap, h: marketCap, l: marketCap, c: marketCap }]
        : [];

  const volume24h = quoteVolumeUsd(volumeQuoteWei, pool, ethUsd, quoteUsd);

  const first = mcapSeries[0] ?? marketCap;
  const last = mcapSeries[mcapSeries.length - 1] ?? marketCap;
  const change24h = first > 0 ? ((last - first) / first) * 100 : pool.change24h ?? 0;

  return {
    source: "onchain",
    live: {
      priceUsd,
      marketCap,
      volume24h: volume24h || base.volume24h,
      liquidity,
      holders: 0,
      txns: swaps.length,
      change5m: 0,
      change1h: change24h * 0.2,
      change6h: change24h * 0.6,
      change24h,
      buyPct: swaps.length ? (buys / decoded.length) * 100 : 50,
      candles,
      swaps: swaps.slice(0, 40),
      holderRows: [],
    },
  };
}

export function isNativeQuote(quote?: Address) {
  return !quote || quote === zeroAddress;
}
