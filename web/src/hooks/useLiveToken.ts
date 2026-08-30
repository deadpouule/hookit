"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_LAUNCH_ETH_USD } from "@/lib/constants";
import {
  fetchIndexerCandles,
  fetchIndexerHolders,
  fetchIndexerToken,
  fetchIndexerTrades,
} from "@/lib/indexer-client";
import { marketCapUsd } from "@/lib/pool-price";
import {
  candleFdvScale,
  fallbackStockUsd,
  marketCapFromQuotePrice,
  marketCapUsdFromLaunchAnchor,
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

function isLikelyAddress(id: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(id);
}

function quoteIsEth(pool: TokenPool) {
  return resolveQuoteKind(pool.quoteAddress, pool.quoteAsset) === "eth";
}

function resolveEthUsd(pool: TokenPool): number {
  if (pool.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * TOTAL_SUPPLY);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return DEFAULT_LAUNCH_ETH_USD;
}

async function fetchOnChainLiveApi(address: string): Promise<LiveTokenState | null> {
  const res = await fetch(`/api/token/${address}/live`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { live?: LiveTokenState };
  return body.live ?? null;
}

export function useLiveToken(pool: TokenPool) {
  const address = pool.contractAddress ?? (isLikelyAddress(pool.id) ? pool.id : null);
  const ethUsd = resolveEthUsd(pool);
  const [live, setLive] = useState<LiveTokenState>(() => buildSparseLive(pool, ethUsd));
  const [source, setSource] = useState<"sparse" | "indexer" | "onchain">("sparse");

  useEffect(() => {
    setLive((prev) => {
      if (source !== "sparse") {
        return {
          ...prev,
          marketCap: pool.marketCap > 0 ? pool.marketCap : prev.marketCap,
          volume24h: pool.volume24h && pool.volume24h > 0 ? pool.volume24h : prev.volume24h,
          change24h: pool.change24h ?? prev.change24h,
          // `pool.liquidity` is TVL USD after enrichPoolsWithSpotPrices.
          liquidity: pool.liquidity > 0 ? pool.liquidity : prev.liquidity,
          priceUsd:
            pool.marketCap > 0 ? pool.marketCap / TOTAL_SUPPLY : prev.priceUsd,
        };
      }
      return {
        ...buildSparseLive(pool, ethUsd),
        candles: prev.candles.length > 1 ? prev.candles : buildSparseLive(pool, ethUsd).candles,
        swaps: prev.swaps,
      };
    });
  }, [
    pool.marketCap,
    pool.volume24h,
    pool.priceEth,
    pool.change24h,
    pool.liquidity,
    pool.id,
    source,
    ethUsd,
  ]);

  const indexerQuery = useQuery({
    queryKey: ["indexer-live", address],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return null;
      const [summary, tradesRes, holdersRes, candlesRes] = await Promise.all([
        fetchIndexerToken(address).catch(() => null),
        fetchIndexerTrades(address, 40).catch(() => ({ trades: [] })),
        fetchIndexerHolders(address, 20).catch(() => ({ holders: [] })),
        fetchIndexerCandles(address, 120).catch(() => ({ candles: [] })),
      ]);
      if (!summary) return null;
      return {
        summary,
        trades: tradesRes.trades,
        holders: holdersRes.holders,
        candles: candlesRes.candles,
      };
    },
    refetchInterval: 20_000,
    retry: false,
  });

  const onchainQuery = useQuery({
    queryKey: ["onchain-live", address],
    enabled: !!address && !indexerQuery.data?.summary && !indexerQuery.isFetching,
    queryFn: async () => {
      if (!address) return null;
      return fetchOnChainLiveApi(address);
    },
    refetchInterval: 20_000,
    retry: 1,
  });

  useEffect(() => {
    const data = indexerQuery.data;
    if (!data?.summary) return;
    const { summary, trades, holders, candles } = data;
    const eth = resolveEthUsd(pool);
    const isEth = quoteIsEth(pool);
    const quoteKind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
    const quoteUsd =
      pool.quoteUsd ??
      (quoteKind === "eth" ? eth : quoteKind === "stable" ? 1 : fallbackStockUsd(pool.quoteAddress) || 1);
    const priceQuote = summary.price ? Number(summary.price) : 0;
    const mcapFromIndexer =
      priceQuote > 0
        ? isEth
          ? marketCapUsd(priceQuote, eth)
          : pool.launchMcapQuoteHuman && pool.launchMcapQuoteHuman > 0
            ? marketCapUsdFromLaunchAnchor(priceQuote, pool.launchMcapQuoteHuman)
            : marketCapFromQuotePrice(priceQuote, quoteUsd ?? 1)
        : 0;
    const mcap =
      pool.marketCap > 0
        ? pool.marketCap
        : mcapFromIndexer > 0
          ? mcapFromIndexer
          : live.marketCap;
    const priceUsd = mcap / TOTAL_SUPPLY;

    const quoteVolRaw = summary.volume24h ? Number(summary.volume24h) : 0;
    const quoteVolUsd = isEth
      ? (quoteVolRaw / 1e18) * eth
      : quoteVolumeUsd(BigInt(Math.trunc(quoteVolRaw)), pool, eth, quoteUsd);

    const candleScale = candleFdvScale(pool, eth, quoteUsd, pool.launchMcapQuoteHuman);
    const mappedCandles: LiveCandle[] =
      candles.length > 0
        ? candles.map((c) => ({
            o: Number(c.o) * candleScale,
            h: Number(c.h) * candleScale,
            l: Number(c.l) * candleScale,
            c: Number(c.c) * candleScale,
          }))
        : mcap > 0
          ? [{ o: mcap, h: mcap, l: mcap, c: mcap }]
          : [];

    setSource("indexer");
    setLive({
      priceUsd,
      marketCap: mcap,
      volume24h: quoteVolUsd > 0 ? quoteVolUsd : pool.volume24h ?? 0,
      // Prefer enriched on-chain TVL; indexer has no TVL field.
      liquidity: pool.liquidity > 0 ? pool.liquidity : mcap,
      change24h: summary.change24h ?? pool.change24h ?? 0,
      change5m: 0,
      change1h: (summary.change24h ?? 0) * 0.2,
      change6h: (summary.change24h ?? 0) * 0.55,
      holders: summary.holdersIndexed || 0,
      txns: summary.tradesIndexed || trades.length,
      buyPct:
        trades.length > 0
          ? (trades.filter((t) => t.side === "buy").length / trades.length) * 100
          : 50,
      swaps: trades.map((t, i) => {
        const qRaw = Number(t.quoteAmount);
        const totalUsd = isEth
          ? (qRaw / 1e18) * eth
          : quoteVolumeUsd(BigInt(Math.trunc(qRaw)), pool, eth, quoteUsd);
        return {
          id: t.id ?? `${t.txHash}-${i}`,
          ageSec: Math.max(0, Math.floor(Date.now() / 1000) - t.timestamp),
          recipient: t.actor ? `${t.actor.slice(0, 6)}…${t.actor.slice(-4)}` : "—",
          side: t.side,
          amount: Number(t.tokenAmount) / 1e18,
          totalUsd,
          marketCap: mcap,
        };
      }),
      holderRows: holders.map((h) => ({
        address: `${h.address.slice(0, 6)}…${h.address.slice(-4)}`,
        pct: h.pct,
        balance: Number(h.balance) / 1e18,
      })),
      candles: mappedCandles,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexerQuery.dataUpdatedAt, pool.marketCap, pool.liquidity, pool.quoteAddress, pool.quoteAsset, pool.quoteUsd]);

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

  return live;
}
