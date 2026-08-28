import type { IndexedTrade, TokenRow } from "./config.js";
import type { Store } from "./store.js";

const SEC_24H = 86_400;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type QuoteVolume = {
  quote: string;
  quoteDecimals: number;
  volumeQuote: string;
  buyVolumeQuote: string;
  sellVolumeQuote: string;
};

export type ProtocolTradeRow = IndexedTrade & {
  token: string;
  quote: string;
  quoteDecimals: number;
  side: "buy" | "sell";
};

export type ProtocolDailyBucket = {
  dayStart: number;
  label: string;
  trades: number;
  quotes: QuoteVolume[];
};

export type ProtocolWindowRollup = {
  trades: number;
  quotes: QuoteVolume[];
};

export type ProtocolIndexerStats = {
  tokensIndexed: number;
  tradesIndexed: number;
  windows: {
    "24h": ProtocolWindowRollup;
    "7d": ProtocolWindowRollup;
    "30d": ProtocolWindowRollup;
    all: ProtocolWindowRollup;
  };
  daily: ProtocolDailyBucket[];
  hourly: ProtocolDailyBucket[];
  recentTrades: ProtocolTradeRow[];
};

function dayLabel(unixSec: number) {
  const d = new Date(unixSec * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function hourLabel(unixSec: number) {
  const d = new Date(unixSec * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

function emptyRollup(): ProtocolWindowRollup {
  return { trades: 0, quotes: [] };
}

function quoteKey(quote: string) {
  return quote.toLowerCase();
}

function findQuote(quotes: QuoteVolume[], quote: string, quoteDecimals: number): QuoteVolume {
  const key = quoteKey(quote);
  let row = quotes.find((q) => quoteKey(q.quote) === key);
  if (!row) {
    row = {
      quote,
      quoteDecimals,
      volumeQuote: "0",
      buyVolumeQuote: "0",
      sellVolumeQuote: "0",
    };
    quotes.push(row);
  }
  return row;
}

function addQuote(
  target: { trades: number; quotes: QuoteVolume[] },
  quoteAmount: bigint,
  side: "buy" | "sell",
  quote: string,
  quoteDecimals: number,
) {
  target.trades += 1;
  const row = findQuote(target.quotes, quote, quoteDecimals);
  row.volumeQuote = (BigInt(row.volumeQuote) + quoteAmount).toString();
  if (side === "buy") {
    row.buyVolumeQuote = (BigInt(row.buyVolumeQuote) + quoteAmount).toString();
  } else {
    row.sellVolumeQuote = (BigInt(row.sellVolumeQuote) + quoteAmount).toString();
  }
}

function collectTrades(store: Store): ProtocolTradeRow[] {
  const rows: ProtocolTradeRow[] = [];
  for (const token of Object.values(store.data.tokens) as TokenRow[]) {
    for (const trade of token.trades) {
      rows.push({
        ...trade,
        token: token.address,
        quote: token.quote,
        quoteDecimals: token.quoteDecimals,
        side: trade.side,
      });
    }
  }
  rows.sort((a, b) => a.timestamp - b.timestamp);
  return rows;
}

export function buildProtocolStats(store: Store): ProtocolIndexerStats {
  const now = Math.floor(Date.now() / 1000);
  const trades = collectTrades(store);
  const windows = {
    "24h": emptyRollup(),
    "7d": emptyRollup(),
    "30d": emptyRollup(),
    all: emptyRollup(),
  };

  const dailyMap = new Map<number, ProtocolDailyBucket>();
  const hourlyMap = new Map<number, ProtocolDailyBucket>();

  for (const trade of trades) {
    const quote = BigInt(trade.quoteAmount);
    addQuote(windows.all, quote, trade.side, trade.quote, trade.quoteDecimals);

    const age = now - trade.timestamp;
    if (age <= SEC_24H) addQuote(windows["24h"], quote, trade.side, trade.quote, trade.quoteDecimals);
    if (age <= SEC_24H * 7) addQuote(windows["7d"], quote, trade.side, trade.quote, trade.quoteDecimals);
    if (age <= SEC_24H * 30) addQuote(windows["30d"], quote, trade.side, trade.quote, trade.quoteDecimals);

    const dayStart = Math.floor(trade.timestamp / SEC_24H) * SEC_24H;
    let day = dailyMap.get(dayStart);
    if (!day) {
      day = { dayStart, label: dayLabel(dayStart), trades: 0, quotes: [] };
      dailyMap.set(dayStart, day);
    }
    addQuote(day, quote, trade.side, trade.quote, trade.quoteDecimals);

    const hourStart = Math.floor(trade.timestamp / 3600) * 3600;
    let hour = hourlyMap.get(hourStart);
    if (!hour) {
      hour = { dayStart: hourStart, label: hourLabel(hourStart), trades: 0, quotes: [] };
      hourlyMap.set(hourStart, hour);
    }
    addQuote(hour, quote, trade.side, trade.quote, trade.quoteDecimals);
  }

  return {
    tokensIndexed: Object.keys(store.data.tokens).length,
    tradesIndexed: trades.length,
    windows,
    daily: [...dailyMap.values()].sort((a, b) => a.dayStart - b.dayStart),
    hourly: [...hourlyMap.values()].sort((a, b) => a.dayStart - b.dayStart),
    recentTrades: [...trades].reverse().slice(0, 100),
  };
}
