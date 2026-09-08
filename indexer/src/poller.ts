import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  fallback,
  http,
  parseAbiItem,
  zeroAddress,
} from "viem";

import { bondingFactoryAbi, erc20Abi, launchFactoryAbi } from "./abis.js";
import type { IndexerConfig, IndexedTrade, TokenRow } from "./config.js";
import { baseSepolia, ink } from "./config.js";
import { absBig, quotePerToken, quotePerTokenFromAmounts } from "./math.js";
import { type Store, tradeId } from "./store.js";

/** getLogs + parseAbiItem — runtime has args; viem 2.55+ types omit them on Log. */
function logArgs<T>(log: unknown): T {
  return (log as { args: T }).args;
}

function tradeLogMeta(log: {
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: Hex | null;
}):
  | { blockNumber: bigint; logIndex: number; transactionHash: Hex }
  | null {
  if (log.blockNumber === null || log.logIndex == null || !log.transactionHash) return null;
  return {
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
  };
}

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const masterLaunchEvent = parseAbiItem(
  "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, bytes32 poolId, address hooks, bool customHook, int24 tickLower, int24 tickUpper, uint128 liquidity)",
);

const shortMasterLaunchEvent = parseAbiItem(
  "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, bytes32 poolId, address hooks, bool customHook)",
);

export function createClient(cfg: IndexerConfig): PublicClient {
  const chain = cfg.chainId === ink.id ? ink : baseSepolia;
  const urls = cfg.rpcUrls.length > 0 ? cfg.rpcUrls : [cfg.rpcUrl];
  const transports = urls.map((url) =>
    http(url, {
      timeout: 20_000,
      retryCount: 0, // outer rpcWithRetry + fallback handle retries
    }),
  );
  return createPublicClient({
    chain,
    transport:
      transports.length === 1
        ? transports[0]!
        : fallback(transports, { rank: false, retryCount: 2 }),
  });
}

const RATE_LIMIT_RE = /rate limit|429|too many requests/i;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retry gel/public RPC throttling with exponential backoff. */
export async function rpcWithRetry<T>(fn: () => Promise<T>, label: string, attempts = 6): Promise<T> {
  let delayMs = 1_500;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = RATE_LIMIT_RE.test(msg) || /timeout|ECONNRESET|fetch failed/i.test(msg);
      if (!retryable || i === attempts - 1) throw err;
      console.warn(`[indexer] ${label} throttled — retry ${i + 1}/${attempts - 1} in ${delayMs}ms`);
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
  throw new Error(`${label} failed after retries`);
}

function getLogs(
  client: PublicClient,
  params: Parameters<PublicClient["getLogs"]>[0],
) {
  return rpcWithRetry(() => client.getLogs(params), "getLogs");
}

function masterFactories(cfg: IndexerConfig): Address[] {
  if (cfg.launchFactories?.length) return cfg.launchFactories;
  return cfg.launchFactory ? [cfg.launchFactory] : [];
}

/** One-shot RPC sanity check — compares full vs legacy TokenLaunched topic filters. */
export async function probeLaunchLogs(client: PublicClient, cfg: IndexerConfig, block: bigint) {
  const factories = masterFactories(cfg);
  if (factories.length === 0) {
    return { block: block.toString(), full: 0, legacy: 0, factory: null as Address | null, factories: [] as Address[] };
  }
  let full = 0;
  let legacy = 0;
  for (const factory of factories) {
    const [f, l] = await Promise.all([
      getLogs(client, {
        address: factory,
        event: masterLaunchEvent,
        fromBlock: block,
        toBlock: block,
      }),
      getLogs(client, {
        address: factory,
        event: shortMasterLaunchEvent,
        fromBlock: block,
        toBlock: block,
      }),
    ]);
    full += f.length;
    legacy += l.length;
  }
  return {
    block: block.toString(),
    factory: factories[0] ?? null,
    factories,
    full,
    legacy,
  };
}

function isPlaceholderMeta(name: string, symbol: string): boolean {
  const n = name.trim().toLowerCase();
  const s = symbol.trim().toLowerCase();
  return !n || n === "unknown" || !s || s === "???" || s === "?" || s === "unknown";
}

async function metaForToken(client: PublicClient, token: Address) {
  const [nameR, symbolR, decimalsR, supplyR] = await Promise.allSettled([
    client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  const name = nameR.status === "fulfilled" ? String(nameR.value) : "";
  const symbol = symbolR.status === "fulfilled" ? String(symbolR.value) : "";
  const decimals = decimalsR.status === "fulfilled" ? Number(decimalsR.value) : 18;
  const totalSupply = supplyR.status === "fulfilled" ? (supplyR.value as bigint) : 0n;
  return {
    name,
    symbol,
    decimals,
    totalSupply: totalSupply.toString(),
  };
}

async function quoteDecimals(client: PublicClient, quote: Address): Promise<number> {
  if (quote === zeroAddress) return 18;
  try {
    const d = await client.readContract({
      address: quote,
      abi: erc20Abi,
      functionName: "decimals",
    });
    return Number(d);
  } catch {
    return 18;
  }
}

function baseTokenRow(
  args: {
    token: Address;
    creator: Address;
    quote: Address;
    launchId: number;
    rail: "master" | "classic";
    poolId: Hex;
    tokenIsCurrency0: boolean;
    factory?: Address;
  },
  meta: { name: string; symbol: string; decimals: number; totalSupply: string },
  quoteDec: number,
): TokenRow {
  return {
    address: args.token,
    poolId: args.poolId,
    quote: args.quote,
    tokenIsCurrency0: args.tokenIsCurrency0,
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    quoteDecimals: quoteDec,
    totalSupply: meta.totalSupply,
    creator: args.creator,
    launchedAt: 0,
    launchId: args.launchId,
    rail: args.rail,
    factory: args.factory,
    holders: {},
    trades: [],
    candles5m: [],
  };
}

async function ensureMasterToken(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  args: {
    launchId: bigint;
    token: Address;
    creator: Address;
    poolId: Hex;
    blockNumber: bigint;
    factory: Address;
  },
) {
  if (store.getToken(args.token)) return;

  const [quoteSettled, launchedAtSettled, meta] = await Promise.all([
    client
      .readContract({
        address: args.factory,
        abi: launchFactoryAbi,
        functionName: "launchQuote",
        args: [args.launchId],
      })
      .catch(() => zeroAddress),
    client
      .readContract({
        address: args.factory,
        abi: launchFactoryAbi,
        functionName: "launchedAt",
        args: [args.launchId],
      })
      .catch(() => BigInt(0)),
    metaForToken(client, args.token),
  ]);

  const q = ((quoteSettled as Address) ?? zeroAddress) as Address;
  const qd = q === zeroAddress ? 18 : await quoteDecimals(client, q);
  const row = baseTokenRow(
    {
      token: args.token,
      creator: args.creator,
      quote: q,
      launchId: Number(args.launchId),
      rail: "master",
      poolId: args.poolId,
      tokenIsCurrency0: BigInt(args.token) < BigInt(q),
      factory: args.factory,
    },
    meta,
    qd,
  );
  row.launchedAt = Number(launchedAtSettled);
  if (row.launchedAt <= 1_000_000_000) {
    const tsMap = await blockTimestamps(client, [args.blockNumber]);
    const ts = tsMap.get(args.blockNumber.toString());
    if (ts) row.launchedAt = ts;
  }
  store.upsertToken(row);
  store.seedSupplyHolder(args.token, args.factory, BigInt(meta.totalSupply));
}

async function ensureClassicToken(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  args: {
    launchId: bigint;
    token: Address;
    creator: Address;
    quote: Address;
    graduationQuote?: bigint;
    blockNumber: bigint;
  },
) {
  if (store.getToken(args.token)) return;
  const [meta, qDec] = await Promise.all([
    metaForToken(client, args.token),
    quoteDecimals(client, args.quote),
  ]);
  const row = baseTokenRow(
    {
      token: args.token,
      creator: args.creator,
      quote: args.quote,
      launchId: Number(args.launchId),
      rail: "classic",
      poolId: "0x0000000000000000000000000000000000000000000000000000000000000000",
      tokenIsCurrency0: BigInt(args.token) < BigInt(args.quote),
      factory: cfg.bondingFactory,
    },
    meta,
    qDec,
  );
  row.bondingPhase = 0;
  if (args.graduationQuote !== undefined) {
    row.graduationQuote = args.graduationQuote.toString();
  }

  if (cfg.bondingFactory) {
    await refreshBondingState(client, store, cfg, args.launchId, row);
    store.seedSupplyHolder(args.token, cfg.bondingFactory, BigInt(meta.totalSupply));
  }

  if (!row.launchedAt || row.launchedAt <= 1_000_000_000) {
    const tsMap = await blockTimestamps(client, [args.blockNumber]);
    const ts = tsMap.get(args.blockNumber.toString());
    if (ts) row.launchedAt = ts;
  }

  store.upsertToken(row);
}

async function refreshBondingState(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  launchId: bigint,
  row?: TokenRow,
) {
  if (!cfg.bondingFactory) return;
  const launch = await readBondingLaunch(client, cfg.bondingFactory, launchId);
  if (!launch) return;
  const target = row ?? store.getToken(launch.token);
  if (!target) return;
  target.bondingPhase = launch.phase;
  target.tokensSold = launch.tokensSold;
  target.realQuote = launch.realQuote;
  target.graduationQuote = launch.graduationQuote;
  const launchedAt = Number(launch.launchedAt);
  if (launchedAt > 1_000_000_000) target.launchedAt = launchedAt;
  target.graduatedAt = launch.graduatedAt;
  if (launch.poolId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    target.poolId = launch.poolId;
    store.upsertToken(target);
  }
}

const blockTsCache = new Map<string, number>();

async function blockTimestamps(client: PublicClient, blockNumbers: bigint[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const missing: bigint[] = [];
  for (const bn of blockNumbers) {
    const key = bn.toString();
    const hit = blockTsCache.get(key);
    if (hit !== undefined) out.set(key, hit);
    else missing.push(bn);
  }
  await Promise.all(
    missing.map(async (bn) => {
      const block = await rpcWithRetry(
        () => client.getBlock({ blockNumber: bn }),
        "getBlock",
      );
      const ts = Number(block.timestamp);
      const key = bn.toString();
      blockTsCache.set(key, ts);
      out.set(key, ts);
    }),
  );
  if (blockTsCache.size > 10_000) blockTsCache.clear();
  return out;
}

export async function tick(client: PublicClient, store: Store, cfg: IndexerConfig): Promise<number> {
  const latest = await rpcWithRetry(() => client.getBlockNumber(), "getBlockNumber");
  const safeHead = latest > cfg.confirmations ? latest - cfg.confirmations : 0n;

  let from = BigInt(store.data.cursor || "0");
  if (from === 0n && cfg.startBlock > 0n) from = cfg.startBlock;
  if (from === 0n) {
    const lookback = 80_000n;
    from = safeHead > lookback ? safeHead - lookback : 0n;
  } else {
    from = from + 1n;
  }
  if (from > safeHead) return 0;

  let processed = 0;
  while (from <= safeHead) {
    const to = from + cfg.chunkSize - 1n > safeHead ? safeHead : from + cfg.chunkSize - 1n;
    await indexRange(client, store, cfg, from, to);
    store.data.cursor = to.toString();
    store.save();
    processed += Number(to - from + 1n);
    from = to + 1n;
    if (from <= safeHead) await sleep(250);
  }
  await refreshPlaceholderNames(client, store);
  return processed;
}

async function refreshPlaceholderNames(client: PublicClient, store: Store) {
  const pending = Object.values(store.data.tokens).filter((row) =>
    isPlaceholderMeta(row.name, row.symbol),
  );
  if (pending.length === 0) return;
  for (const row of pending) {
    const meta = await metaForToken(client, row.address);
    if (isPlaceholderMeta(meta.name, meta.symbol)) continue;
    row.name = meta.name;
    row.symbol = meta.symbol;
    if (meta.decimals) row.decimals = meta.decimals;
    if (meta.totalSupply && meta.totalSupply !== "0") row.totalSupply = meta.totalSupply;
  }
}

async function indexMasterFactory(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  factory: Address,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const logs = await getLogs(client, {
    address: factory,
    event: masterLaunchEvent,
    fromBlock,
    toBlock,
  });
  if (logs.length > 0) {
    console.log(
      `[indexer] TokenLaunched x${logs.length} blocks ${fromBlock}-${toBlock} factory=${factory}`,
    );
  }
  for (const log of logs) {
    const a = logArgs<{
      launchId: bigint;
      token: Address;
      creator: Address;
      poolId: Hex;
    }>(log);
    await ensureMasterToken(client, store, cfg, {
      launchId: a.launchId,
      token: a.token,
      creator: a.creator,
      poolId: a.poolId,
      blockNumber: log.blockNumber ?? fromBlock,
      factory,
    });
  }

  const configured = await getLogs(client, {
    address: factory,
    event: parseAbiItem(
      "event LaunchConfigured(uint256 indexed launchId, uint256 bitmask, address quote, int24 tickSpacing, uint24 fee)",
    ),
    fromBlock,
    toBlock,
  });
  for (const log of configured) {
    const a = logArgs<{ launchId: bigint; bitmask: bigint }>(log);
    const row = store.tokenForLaunchId(a.launchId, factory);
    if (row) row.hookModules = a.bitmask.toString();
  }

  const multiConfigured = await getLogs(client, {
    address: factory,
    event: parseAbiItem(
      "event MultiLaunchConfigured(uint256 indexed launchId, uint8 marketCount, uint8 floorQuoteIndex, uint256 bitmask)",
    ),
    fromBlock,
    toBlock,
  });
  for (const log of multiConfigured) {
    const a = logArgs<{ launchId: bigint; marketCount: number; bitmask: bigint }>(log);
    const row = store.tokenForLaunchId(a.launchId, factory);
    if (row) {
      row.marketCount = Number(a.marketCount);
      row.hookModules = a.bitmask.toString();
    }
  }

  const marketLaunched = await getLogs(client, {
    address: factory,
    event: parseAbiItem(
      "event MarketLaunched(uint256 indexed launchId, uint8 indexed marketIndex, bytes32 poolId, address quote, uint16 bps, int24 tickLower, int24 tickUpper, uint128 liquidity)",
    ),
    fromBlock,
    toBlock,
  });
  for (const log of marketLaunched) {
    const a = logArgs<{
      launchId: bigint;
      marketIndex: number;
      poolId: Hex;
      quote: Address;
      bps: number;
      tickLower: number;
      tickUpper: number;
      liquidity: bigint;
    }>(log);
    const row = store.tokenForLaunchId(a.launchId, factory);
    if (!row) continue;
    const tokenIsCurrency0 = BigInt(row.address) < BigInt(a.quote);
    store.registerMarket(
      row.address,
      {
        poolId: a.poolId,
        quote: a.quote,
        bps: Number(a.bps),
        tokenIsCurrency0: tokenIsCurrency0,
        tickLower: Number(a.tickLower),
        tickUpper: Number(a.tickUpper),
        liquidity: a.liquidity.toString(),
      },
      row.marketCount,
    );
  }
}

async function indexRange(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  fromBlock: bigint,
  toBlock: bigint,
) {
  for (const factory of masterFactories(cfg)) {
    await indexMasterFactory(client, store, cfg, factory, fromBlock, toBlock);
  }

  if (cfg.bondingFactory) {
    const launched = await getLogs(client,{
      address: cfg.bondingFactory,
      event: parseAbiItem(
        "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, address quote, uint256 graduationQuote)",
      ),
      fromBlock,
      toBlock,
    });
    for (const log of launched) {
      const a = logArgs<{
        launchId: bigint;
        token: Address;
        creator: Address;
        quote: Address;
        graduationQuote: bigint;
      }>(log);
      await ensureClassicToken(client, store, cfg, {
        launchId: a.launchId,
        token: a.token,
        creator: a.creator,
        quote: a.quote,
        graduationQuote: a.graduationQuote,
        blockNumber: log.blockNumber ?? fromBlock,
      });
    }

    const graduated = await getLogs(client,{
      address: cfg.bondingFactory,
      event: parseAbiItem(
        "event Graduated(uint256 indexed launchId, bytes32 indexed poolId, uint256 quoteLp, uint256 tokenLp, uint128 liquidity)",
      ),
      fromBlock,
      toBlock,
    });
    for (const log of graduated) {
      const a = logArgs<{ launchId: bigint; poolId: Hex }>(log);
      const row = store.tokenForLaunchId(a.launchId, cfg.bondingFactory);
      if (row) {
        row.poolId = a.poolId;
        row.bondingPhase = 2;
        store.upsertToken(row);
      }
      await refreshBondingState(client, store, cfg, a.launchId);
    }

    await indexBondingTrades(client, store, cfg, fromBlock, toBlock);
  }

  const poolIds = Object.keys(store.data.poolToToken);
  if (poolIds.length > 0) {
    const POOL_CHUNK = 40;
    for (let i = 0; i < poolIds.length; i += POOL_CHUNK) {
      const batch = poolIds.slice(i, i + POOL_CHUNK) as Hex[];
      const swapLogs = await getLogs(client,{
        address: cfg.poolManager,
        event: parseAbiItem(
          "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
        ),
        args: { id: batch },
        fromBlock,
        toBlock,
      });

      const blocks = [...new Set(swapLogs.map((l) => l.blockNumber).filter((b): b is bigint => b != null))];
      const tsMap = await blockTimestamps(client, blocks);

      for (const log of swapLogs) {
        const args = logArgs<{
          id: Hex;
          sender: Address;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
        }>(log);
        const row = store.tokenForPool(args.id);
        const meta = tradeLogMeta(log);
        if (!row || !meta) continue;

        const ts = tsMap.get(meta.blockNumber.toString()) ?? 0;
        const market = row.markets?.find((m) => m.poolId.toLowerCase() === args.id.toLowerCase());
        const tokenIsCurrency0 = market?.tokenIsCurrency0 ?? row.tokenIsCurrency0;
        const tokenAmt = tokenIsCurrency0 ? absBig(args.amount0) : absBig(args.amount1);
        const quoteAmt = tokenIsCurrency0 ? absBig(args.amount1) : absBig(args.amount0);
        const quoteDelta = tokenIsCurrency0 ? args.amount1 : args.amount0;
        // Quote inflow to the pool means a buy of the launch token.
        const side = quoteDelta > 0n ? "buy" : "sell";
        const price = quotePerToken(args.sqrtPriceX96, tokenIsCurrency0);

        const trade: IndexedTrade = {
          id: tradeId(meta.transactionHash, meta.logIndex),
          txHash: meta.transactionHash,
          logIndex: meta.logIndex,
          blockNumber: Number(meta.blockNumber),
          timestamp: ts,
          side,
          quoteAmount: quoteAmt.toString(),
          tokenAmount: tokenAmt.toString(),
          price,
          sqrtPriceX96: args.sqrtPriceX96.toString(),
          actor: args.sender,
          poolId: args.id,
        };
        store.pushTrade(row.address, trade);
      }
    }
  }

  const tokens = Object.keys(store.data.tokens);
  if (tokens.length > 0) {
    const transferLogs = await getLogs(client,{
      address: tokens as Address[],
      event: transferEvent,
      fromBlock,
      toBlock,
    });
    for (const log of transferLogs) {
      const a = logArgs<{ from: Address; to: Address; value: bigint }>(log);
      store.applyTransfer(log.address as Address, a.from, a.to, a.value);
    }
  }
}

async function indexBondingTrades(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  fromBlock: bigint,
  toBlock: bigint,
) {
  if (!cfg.bondingFactory) return;

  const bought = await getLogs(client,{
    address: cfg.bondingFactory,
    event: parseAbiItem(
      "event Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 feeQuote)",
    ),
    fromBlock,
    toBlock,
  });

  const sold = await getLogs(client,{
    address: cfg.bondingFactory,
    event: parseAbiItem(
      "event Sold(uint256 indexed launchId, address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 feeQuote)",
    ),
    fromBlock,
    toBlock,
  });

  const all = [...bought, ...sold];
  const blocks = [...new Set(all.map((l) => l.blockNumber).filter((b): b is bigint => b != null))];
  const tsMap = await blockTimestamps(client, blocks);

  for (const log of bought) {
    const a = logArgs<{
      launchId: bigint;
      buyer: Address;
      quoteIn: bigint;
      tokensOut: bigint;
    }>(log);
    const row = store.tokenForLaunchId(a.launchId, cfg.bondingFactory);
    const meta = tradeLogMeta(log);
    if (!row || !meta) continue;
    const ts = tsMap.get(meta.blockNumber.toString()) ?? 0;
    const price = quotePerTokenFromAmounts(a.quoteIn, a.tokensOut, row.decimals, row.quoteDecimals);
    store.pushTrade(row.address, {
      id: tradeId(meta.transactionHash, meta.logIndex),
      txHash: meta.transactionHash,
      logIndex: meta.logIndex,
      blockNumber: Number(meta.blockNumber),
      timestamp: ts,
      side: "buy",
      quoteAmount: a.quoteIn.toString(),
      tokenAmount: a.tokensOut.toString(),
      price,
      sqrtPriceX96: "0",
      actor: a.buyer,
    });
    await refreshBondingState(client, store, cfg, a.launchId);
  }

  for (const log of sold) {
    const a = logArgs<{
      launchId: bigint;
      seller: Address;
      tokensIn: bigint;
      quoteOut: bigint;
    }>(log);
    const row = store.tokenForLaunchId(a.launchId, cfg.bondingFactory);
    const meta = tradeLogMeta(log);
    if (!row || !meta) continue;
    const ts = tsMap.get(meta.blockNumber.toString()) ?? 0;
    const price = quotePerTokenFromAmounts(a.quoteOut, a.tokensIn, row.decimals, row.quoteDecimals);
    store.pushTrade(row.address, {
      id: tradeId(meta.transactionHash, meta.logIndex),
      txHash: meta.transactionHash,
      logIndex: meta.logIndex,
      blockNumber: Number(meta.blockNumber),
      timestamp: ts,
      side: "sell",
      quoteAmount: a.quoteOut.toString(),
      tokenAmount: a.tokensIn.toString(),
      price,
      sqrtPriceX96: "0",
      actor: a.seller,
    });
    await refreshBondingState(client, store, cfg, a.launchId);
  }
}

async function readBondingLaunch(
  client: PublicClient,
  bonding: Address,
  launchId: bigint,
): Promise<{
  token: Address;
  creator: Address;
  quote: Address;
  poolId: Hex;
  phase: number;
  tokensSold: string;
  realQuote: string;
  graduationQuote: string;
  launchedAt: number;
  graduatedAt: number;
} | null> {
  try {
    const launch = await client.readContract({
      address: bonding,
      abi: bondingFactoryAbi,
      functionName: "launches",
      args: [launchId],
    });
    const row = launch as readonly [
      Address,
      Address,
      Address,
      number,
      number,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      Hex,
      bigint,
      bigint,
    ];
    return {
      token: row[0],
      creator: row[1],
      quote: row[2],
      phase: Number(row[3]),
      tokensSold: row[7].toString(),
      realQuote: row[8].toString(),
      graduationQuote: row[11].toString(),
      poolId: row[12],
      launchedAt: Number(row[13]),
      graduatedAt: Number(row[14]),
    };
  } catch {
    return null;
  }
}
