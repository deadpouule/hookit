import type { IndexerTrade } from "@/lib/indexer-client";

export const STATS_WINDOWS = ["5m", "1h", "6h", "24h"] as const;
export type StatsWindow = (typeof STATS_WINDOWS)[number];

export const STATS_WINDOW_SEC: Record<StatsWindow, number> = {
  "5m": 300,
  "1h": 3600,
  "6h": 21_600,
  "24h": 86_400,
};

export type WindowActivityStats = {
  txns: number;
  volumeQuote: string;
  buyCount: number;
  sellCount: number;
  buyVolumeQuote: string;
  sellVolumeQuote: string;
  buyPct: number;
};

export type TokenWindowStats = Record<StatsWindow, WindowActivityStats>;

function emptyWindowStats(): WindowActivityStats {
  return {
    txns: 0,
    volumeQuote: "0",
    buyCount: 0,
    sellCount: 0,
    buyVolumeQuote: "0",
    sellVolumeQuote: "0",
    buyPct: 50,
  };
}

export function emptyTokenWindowStats(): TokenWindowStats {
  return {
    "5m": emptyWindowStats(),
    "1h": emptyWindowStats(),
    "6h": emptyWindowStats(),
    "24h": emptyWindowStats(),
  };
}

/** Compute buy/sell activity per window from indexed on-chain trades. */
export function activityFromTrades(trades: IndexerTrade[], nowSec = Math.floor(Date.now() / 1000)): TokenWindowStats {
  const out = emptyTokenWindowStats();

  for (const window of STATS_WINDOWS) {
    const cutoff = nowSec - STATS_WINDOW_SEC[window];
    let buyCount = 0;
    let sellCount = 0;
    let buyVolumeQuote = 0n;
    let sellVolumeQuote = 0n;

    for (const trade of trades) {
      if (trade.timestamp < cutoff) continue;
      const quote = BigInt(trade.quoteAmount);
      if (trade.side === "buy") {
        buyCount += 1;
        buyVolumeQuote += quote;
      } else {
        sellCount += 1;
        sellVolumeQuote += quote;
      }
    }

    const txns = buyCount + sellCount;
    out[window] = {
      txns,
      volumeQuote: (buyVolumeQuote + sellVolumeQuote).toString(),
      buyCount,
      sellCount,
      buyVolumeQuote: buyVolumeQuote.toString(),
      sellVolumeQuote: sellVolumeQuote.toString(),
      buyPct: txns > 0 ? (buyCount / txns) * 100 : 50,
    };
  }

  return out;
}

export function quoteVolToUsd(raw: string, decimals: number, isEth: boolean, ethUsd: number) {
  const n = Number(raw);
  if (!(n > 0)) return 0;
  if (isEth) return (n / 10 ** decimals) * ethUsd;
  return n / 10 ** decimals;
}

export function mapWindowVolumes(
  windows: TokenWindowStats,
  decimals: number,
  isEth: boolean,
  ethUsd: number,
) {
  const mapped = {} as Record<
    StatsWindow,
    {
      txns: number;
      volumeUsd: number;
      buyCount: number;
      sellCount: number;
      buyVolumeUsd: number;
      sellVolumeUsd: number;
      buyPct: number;
    }
  >;

  for (const window of STATS_WINDOWS) {
    const row = windows[window];
    const buyVolUsd = quoteVolToUsd(row.buyVolumeQuote, decimals, isEth, ethUsd);
    const sellVolUsd = quoteVolToUsd(row.sellVolumeQuote, decimals, isEth, ethUsd);
    mapped[window] = {
      txns: row.txns,
      volumeUsd: quoteVolToUsd(row.volumeQuote, decimals, isEth, ethUsd),
      buyCount: row.buyCount,
      sellCount: row.sellCount,
      buyVolumeUsd: buyVolUsd,
      sellVolumeUsd: sellVolUsd,
      buyPct: row.buyPct,
    };
  }

  return mapped;
}
