"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useLaunchEthUsd } from "@/hooks/useEthUsd";
import { useTokenIndexerData } from "@/hooks/useTokenIndexerData";
import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import { fetchIndexerToken, statsFromIndexerTrades } from "@/lib/indexer-client";
import { TOKEN_TICKER_REFETCH_MS } from "@/lib/query-cache";
import { isMultiPool } from "@/lib/pool-active-market";
import {
  candleFdvScale,
  fallbackStockUsd,
  marketCapUsdForPool,
  quoteVolumeUsd,
  resolveQuoteKind,
} from "@/lib/quote-usd";
import {
  TOTAL_SUPPLY,
  type LiveCandle,
  type LiveTokenState,
} from "@/lib/token-live";
import { buildSparseLive } from "@/lib/token-onchain-live";
import type { TokenPool } from "@/lib/types";

export type LiveTokenResult = {
  live: LiveTokenState;
  /** True while switching pools or waiting for indexer/on-chain for the active leg. */
  isLoading: boolean;
};

function isLikelyAddress(id: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(id);
}

function quoteIsEth(pool: TokenPool) {
  return resolveQuoteKind(pool.quoteAddress, pool.quoteAsset) === "eth";
}

function resolveEthUsd(pool: TokenPool, launchEthUsd?: number): number {
  if (quoteIsEth(pool) && pool.quoteUsd && pool.quoteUsd > 100 && pool.quoteUsd < 1_000_000) {
    return pool.quoteUsd;
  }
  if (launchEthUsd && launchEthUsd > 100 && launchEthUsd < 1_000_000) return launchEthUsd;
  if (pool.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * TOTAL_SUPPLY);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return DEFAULT_LAUNCH_ETH_USD;
}

function candlesLookBroken(candles: LiveCandle[], mcap: number): boolean {
  if (candles.length === 0) return true;
  const last = candles[candles.length - 1]!.c;
  if (!(last > 0)) return true;
  // Indexer mixed-quote corruption often produces near-zero FDV vs ~$5k spot.
  if (mcap > 0 && last < mcap * 0.01) return true;
  return false;
}

function summaryMatchesPool(
  summaryPoolId: string | null | undefined,
  poolId: string | null | undefined,
): boolean {
  if (!poolId) return true;
  if (!summaryPoolId) return true;
  return summaryPoolId.toLowerCase() === poolId.toLowerCase();
}

async function fetchOnChainLiveApi(
  address: string,
  poolId?: string | null,
): Promise<LiveTokenState | null> {
  const q = poolId ? `?poolId=${encodeURIComponent(poolId)}` : "";
  const res = await fetch(`/api/token/${address}/live${q}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { live?: LiveTokenState };
  return body.live ?? null;
}

export function useLiveToken(pool: TokenPool): LiveTokenResult {
  const address = pool.contractAddress ?? (isLikelyAddress(pool.id) ? pool.id : null);
  const launchEthUsd = useLaunchEthUsd();
  const ethUsd = resolveEthUsd(pool, launchEthUsd);
  const multi = isMultiPool(pool);
  const [live, setLive] = useState<LiveTokenState>(() => buildSparseLive(pool, ethUsd));
  const [source, setSource] = useState<"sparse" | "indexer" | "onchain">("sparse");

  useEffect(() => {
    setSource("sparse");
    setLive(buildSparseLive(pool, ethUsd));
  }, [pool.poolId, pool.id, pool.quoteAddress]);

  useEffect(() => {
    if (source === "sparse" || pool.marketCap <= 0) return;
    setLive((prev) => ({
      ...prev,
      marketCap: pool.marketCap,
      volume24h: pool.volume24h && pool.volume24h > 0 ? pool.volume24h : prev.volume24h,
      change24h: pool.change24h ?? prev.change24h,
      liquidity: pool.liquidity > 0 ? pool.liquidity : prev.liquidity,
      priceUsd: pool.marketCap / TOTAL_SUPPLY,
    }));
  }, [
    pool.marketCap,
    pool.volume24h,
    pool.change24h,
    pool.liquidity,
    pool.id,
    source,
  ]);

  const tickerQuery = useQuery({
    queryKey: ["indexer-token-tick", address, pool.poolId],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      return fetchIndexerToken(address, pool.poolId ?? undefined);
    },
    refetchInterval: TOKEN_TICKER_REFETCH_MS,
    staleTime: 0,
    retry: false,
  });

  const indexerQuery = useTokenIndexerData(address, {
    poolId: pool.poolId,
    candlesLimit: 2_000,
    tradesLimit: 500,
  });

  const onchainQuery = useQuery({
    queryKey: ["onchain-live", address, pool.poolId],
    enabled:
      !!address &&
      (!!pool.poolId || !indexerQuery.data?.summary) &&
      (multi || (!indexerQuery.data?.summary && !indexerQuery.isFetching)),
    queryFn: async () => {
      if (!address) return null;
      return fetchOnChainLiveApi(address, pool.poolId);
    },
    refetchInterval: 8_000,
    retry: 1,
  });

  useEffect(() => {
    const data = indexerQuery.data;
    const summary = data?.summary;
    if (!summary || !summaryMatchesPool(summary.poolId, pool.poolId)) return;

    const { trades, holders, candles } = data;
    const eth = resolveEthUsd(pool, launchEthUsd);
    const isEth = quoteIsEth(pool);
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const quoteUsd =
      pool.quoteUsd ??
      (quoteKind === "eth" ? eth : quoteKind === "stable" ? 1 : fallbackStockUsd(pool.quoteAddress) || 1);
    const priceQuote = summary.price ? Number(summary.price) : 0;
    const mcapFromIndexer =
      priceQuote > 0
        ? marketCapUsdForPool(priceQuote, pool, eth, quoteUsd, pool.launchMcapQuoteHuman)
        : 0;
    const mcap =
      mcapFromIndexer > 0
        ? mcapFromIndexer
        : pool.marketCap > 0
          ? pool.marketCap
          : live.marketCap;
    const priceUsd = mcap / TOTAL_SUPPLY;

    const tradeStats = statsFromIndexerTrades(trades);
    const quoteVolRaw = summary.volume24h ? Number(summary.volume24h) : 0;
    const summaryVolUsd = isEth
      ? (quoteVolRaw / 1e18) * eth
      : quoteVolumeUsd(BigInt(Math.trunc(quoteVolRaw)), pool, eth, quoteUsd);
    const quoteVolUsd =
      tradeStats.volumeWei > 0n
        ? quoteVolumeUsd(tradeStats.volumeWei, pool, eth, quoteUsd)
        : summaryVolUsd;

    const candleScale = candleFdvScale(pool, eth, quoteUsd, pool.launchMcapQuoteHuman);
    const volumeUsdForTrade = (vQuote: string) => {
      try {
        return quoteVolumeUsd(BigInt(vQuote || "0"), pool, eth, quoteUsd);
      } catch {
        return 0;
      }
    };
    const candles5m: LiveCandle[] =
      candles.length > 0
        ? candles
            .filter((c) => typeof c.t === "number" && c.t > 0)
            .map((c) => ({
              o: Number(c.o) * candleScale,
              h: Number(c.h) * candleScale,
              l: Number(c.l) * candleScale,
              c: Number(c.c) * candleScale,
              t: c.t,
              v: volumeUsdForTrade(c.vQuote || "0"),
            }))
        : [];
    const fromTrades: LiveCandle[] = [...trades]
      .filter((t) => t.timestamp > 0 && Number(t.price) > 0)
      .sort((a, b) => a.timestamp - b.timestamp)
      .reduce<LiveCandle[]>((series, t) => {
        const bucket = Math.floor(t.timestamp / 60) * 60;
        const px = Number(t.price) * candleScale;
        const vol = volumeUsdForTrade(t.quoteAmount);
        const last = series[series.length - 1];
        if (!last || last.t !== bucket) {
          series.push({ t: bucket, o: px, h: px, l: px, c: px, v: vol });
        } else {
          last.h = Math.max(last.h, px);
          last.l = Math.min(last.l, px);
          last.c = px;
          last.v = (last.v ?? 0) + vol;
        }
        return series;
      }, []);
    let mappedCandles: LiveCandle[] = fromTrades;
    if (fromTrades.length && candles5m.length) {
      const firstTrade = fromTrades[0]!.t!;
      mappedCandles = [...candles5m.filter((c) => (c.t ?? 0) + 60 < firstTrade), ...fromTrades];
    } else if (!fromTrades.length) {
      mappedCandles = candles5m;
    }

    if (candlesLookBroken(mappedCandles, mcap) && onchainQuery.data?.candles?.length) {
      mappedCandles = onchainQuery.data.candles;
      setSource("onchain");
      setLive({
        ...onchainQuery.data,
        marketCap: mcap > 0 ? mcap : onchainQuery.data.marketCap,
        liquidity: pool.liquidity > 0 ? pool.liquidity : onchainQuery.data.liquidity,
        holders: summary.holdersIndexed || onchainQuery.data.holders,
        holderRows:
          holders.length > 0
            ? holders.map((h) => ({
                address: `${h.address.slice(0, 6)}…${h.address.slice(-4)}`,
                holderAddress: h.address,
                pct: h.pct,
                balance: Number(h.balance) / 1e18,
              }))
            : onchainQuery.data.holderRows,
      });
      return;
    }

    if (candlesLookBroken(mappedCandles, mcap) && mcap > 0) {
      mappedCandles = fromTrades.length > 0 ? fromTrades : [];
    }

    const recentTrades = trades.slice(0, 40);

    setSource("indexer");
    setLive({
      priceUsd,
      marketCap: mcap,
      volume24h: quoteVolUsd > 0 ? quoteVolUsd : pool.volume24h ?? 0,
      liquidity: pool.liquidity > 0 ? pool.liquidity : mcap,
      change24h: tradeStats.change ?? summary.change24h ?? pool.change24h ?? 0,
      change5m: summary.change5m ?? 0,
      change1h: summary.change1h ?? 0,
      change6h: summary.change6h ?? 0,
      holders: summary.holdersIndexed || 0,
      txns: summary.tradesIndexed || recentTrades.length,
      buyPct:
        recentTrades.length > 0
          ? (recentTrades.filter((t) => t.side === "buy").length / recentTrades.length) * 100
          : 50,
      swaps: recentTrades.map((t, i) => {
        const qRaw = Number(t.quoteAmount);
        const totalUsd = isEth
          ? (qRaw / 1e18) * eth
          : quoteVolumeUsd(BigInt(Math.trunc(qRaw)), pool, eth, quoteUsd);
        const tradeMcap = Number(t.price) * candleScale;
        return {
          id: t.id ?? `${t.txHash}-${i}`,
          ageSec: Math.max(0, Math.floor(Date.now() / 1000) - t.timestamp),
          t: t.timestamp,
          recipient: t.actor ? `${t.actor.slice(0, 6)}…${t.actor.slice(-4)}` : "·",
          recipientAddress: t.actor || undefined,
          txHash: t.txHash || undefined,
          side: t.side,
          amount: Number(t.tokenAmount) / 1e18,
          totalUsd,
          marketCap: Number.isFinite(tradeMcap) && tradeMcap > 0 ? tradeMcap : mcap,
        };
      }),
      holderRows: holders.map((h) => ({
        address: `${h.address.slice(0, 6)}…${h.address.slice(-4)}`,
        holderAddress: h.address,
        pct: h.pct,
        balance: Number(h.balance) / 1e18,
      })),
      candles: mappedCandles,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    indexerQuery.dataUpdatedAt,
    onchainQuery.dataUpdatedAt,
    pool.marketCap,
    pool.liquidity,
    pool.quoteAddress,
    pool.quoteAsset,
    pool.quoteUsd,
    pool.poolId,
    launchEthUsd,
  ]);

  useEffect(() => {
    if (indexerQuery.data?.summary) return;
    const onchain = onchainQuery.data;
    if (!onchain) return;
    setSource("onchain");
    setLive({
      ...onchain,
      marketCap: pool.marketCap > 0 ? pool.marketCap : onchain.marketCap,
      liquidity: pool.liquidity > 0 ? pool.liquidity : onchain.liquidity,
    });
  }, [onchainQuery.dataUpdatedAt, onchainQuery.data, indexerQuery.data?.summary, pool]);

  useEffect(() => {
    const summary = tickerQuery.data;
    if (!summary || !summaryMatchesPool(summary.poolId, pool.poolId)) return;

    const eth = resolveEthUsd(pool, launchEthUsd);
    const isEth = quoteIsEth(pool);
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const quoteUsd =
      pool.quoteUsd ??
      (quoteKind === "eth" ? eth : quoteKind === "stable" ? 1 : fallbackStockUsd(pool.quoteAddress) || 1);
    const priceQuote = summary.price ? Number(summary.price) : 0;
    const mcapFromIndexer =
      priceQuote > 0
        ? marketCapUsdForPool(priceQuote, pool, eth, quoteUsd, pool.launchMcapQuoteHuman)
        : 0;

    const quoteVolRaw = summary.volume24h ? Number(summary.volume24h) : 0;
    let volUsd = 0;
    try {
      volUsd = isEth
        ? (quoteVolRaw / 1e18) * eth
        : quoteVolumeUsd(BigInt(Math.trunc(quoteVolRaw)), pool, eth, quoteUsd);
    } catch {
      volUsd = 0;
    }

    setLive((prev) => {
      const marketCap = mcapFromIndexer > 0 ? mcapFromIndexer : prev.marketCap;
      return {
        ...prev,
        marketCap,
        priceUsd: marketCap / TOTAL_SUPPLY,
        volume24h: volUsd > 0 ? volUsd : prev.volume24h,
        change24h: summary.change24h ?? prev.change24h,
        holders: summary.holdersIndexed || prev.holders,
      };
    });
  }, [
    tickerQuery.dataUpdatedAt,
    pool.poolId,
    pool.quoteAddress,
    pool.quoteAsset,
    pool.quoteUsd,
    pool.launchMcapQuoteHuman,
    launchEthUsd,
  ]);

  const isLoading =
    !!address &&
    source === "sparse" &&
    (indexerQuery.isPending || indexerQuery.isFetching || onchainQuery.isFetching);

  return { live, isLoading };
}
