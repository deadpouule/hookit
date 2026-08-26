import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  http,
  parseAbiItem,
  zeroAddress,
} from "viem";

import { bondingFactoryAbi, erc20Abi, launchFactoryAbi } from "./abis.js";
import type { IndexerConfig, IndexedTrade, TokenRow } from "./config.js";
import { baseSepolia, ink } from "./config.js";
import { absBig, quotePerToken } from "./math.js";
import type { Store } from "./store.js";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export function createClient(cfg: IndexerConfig): PublicClient {
  const chain = cfg.chainId === ink.id ? ink : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  });
}

async function metaForToken(client: PublicClient, token: Address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "name" }).catch(() => "Unknown"),
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => "???"),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }).catch(() => 0n),
  ]);
  return {
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
    totalSupply: (totalSupply as bigint).toString(),
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
  },
) {
  if (store.getToken(args.token)) return;
  if (!cfg.launchFactory) return;

  const [quote, launchedAt, meta] = await Promise.all([
    client.readContract({
      address: cfg.launchFactory,
      abi: launchFactoryAbi,
      functionName: "launchQuote",
      args: [args.launchId],
    }),
    client.readContract({
      address: cfg.launchFactory,
      abi: launchFactoryAbi,
      functionName: "launchedAt",
      args: [args.launchId],
    }),
    metaForToken(client, args.token),
  ]);

  const q = (quote as Address) ?? zeroAddress;
  const row: TokenRow = {
    address: args.token,
    poolId: args.poolId,
    quote: q,
    tokenIsCurrency0: BigInt(args.token) < BigInt(q),
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: meta.totalSupply,
    creator: args.creator,
    launchedAt: Number(launchedAt),
    launchId: Number(args.launchId),
    rail: "master",
    holders: {},
    trades: [],
    candles5m: [],
  };
  store.upsertToken(row);
  void args.blockNumber;
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
    blockNumber: bigint;
  },
) {
  if (store.getToken(args.token)) return;
  const meta = await metaForToken(client, args.token);
  const row: TokenRow = {
    address: args.token,
    poolId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    quote: args.quote,
    tokenIsCurrency0: BigInt(args.token) < BigInt(args.quote),
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: meta.totalSupply,
    creator: args.creator,
    launchedAt: 0,
    launchId: Number(args.launchId),
    rail: "classic",
    holders: {},
    trades: [],
    candles5m: [],
  };

  if (cfg.bondingFactory) {
    try {
      const launch = await readBondingLaunch(client, cfg.bondingFactory, args.launchId);
      if (launch) {
        row.launchedAt = launch.launchedAt;
        if (launch.poolId && launch.poolId !== row.poolId) {
          row.poolId = launch.poolId;
        }
      }
    } catch {
      /* ignore */
    }
  }

  store.upsertToken(row);
  void args.blockNumber;
}

const blockTsCache = new Map<string, number>();

async function blockTimestamp(client: PublicClient, blockNumber: bigint): Promise<number> {
  const key = blockNumber.toString();
  const hit = blockTsCache.get(key);
  if (hit) return hit;
  const block = await client.getBlock({ blockNumber });
  const ts = Number(block.timestamp);
  blockTsCache.set(key, ts);
  if (blockTsCache.size > 5_000) blockTsCache.clear();
  return ts;
}

export async function tick(client: PublicClient, store: Store, cfg: IndexerConfig): Promise<number> {
  const latest = await client.getBlockNumber();
  let from = BigInt(store.data.cursor || "0");
  if (from === 0n && cfg.startBlock > 0n) from = cfg.startBlock;
  if (from === 0n) {
    // First run: only look back ~2 days of ~2s blocks (~86k) to stay RPC-friendly.
    const lookback = 80_000n;
    from = latest > lookback ? latest - lookback : 0n;
  } else {
    from = from + 1n;
  }
  if (from > latest) return 0;

  let processed = 0;
  while (from <= latest) {
    const to = from + cfg.chunkSize - 1n > latest ? latest : from + cfg.chunkSize - 1n;
    await indexRange(client, store, cfg, from, to);
    store.data.cursor = to.toString();
    store.save();
    processed += Number(to - from + 1n);
    from = to + 1n;
  }
  return processed;
}

async function indexRange(
  client: PublicClient,
  store: Store,
  cfg: IndexerConfig,
  fromBlock: bigint,
  toBlock: bigint,
) {
  if (cfg.launchFactory) {
    const logs = await client.getLogs({
      address: cfg.launchFactory,
      event: parseAbiItem(
        "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, bytes32 poolId, address hooks, bool customHook, int24 tickLower, int24 tickUpper, uint128 liquidity)",
      ),
      fromBlock,
      toBlock,
    });
    for (const log of logs) {
      const a = log.args as {
        launchId: bigint;
        token: Address;
        creator: Address;
        poolId: Hex;
      };
      await ensureMasterToken(client, store, cfg, {
        launchId: a.launchId,
        token: a.token,
        creator: a.creator,
        poolId: a.poolId,
        blockNumber: log.blockNumber ?? fromBlock,
      });
    }
  }

  if (cfg.bondingFactory) {
    const launched = await client.getLogs({
      address: cfg.bondingFactory,
      event: parseAbiItem(
        "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, address quote, uint256 graduationQuote)",
      ),
      fromBlock,
      toBlock,
    });
    for (const log of launched) {
      const a = log.args as {
        launchId: bigint;
        token: Address;
        creator: Address;
        quote: Address;
      };
      await ensureClassicToken(client, store, cfg, {
        launchId: a.launchId,
        token: a.token,
        creator: a.creator,
        quote: a.quote,
        blockNumber: log.blockNumber ?? fromBlock,
      });
    }

    const graduated = await client.getLogs({
      address: cfg.bondingFactory,
      event: parseAbiItem(
        "event Graduated(uint256 indexed launchId, bytes32 indexed poolId, uint256 quoteLp, uint256 tokenLp, uint128 liquidity)",
      ),
      fromBlock,
      toBlock,
    });
    for (const log of graduated) {
      const a = log.args as { launchId: bigint; poolId: Hex };
      if (!cfg.bondingFactory) continue;
      const launch = await readBondingLaunch(client, cfg.bondingFactory, a.launchId);
      if (!launch) continue;
      const row = store.getToken(launch.token);
      if (row) {
        row.poolId = a.poolId;
        store.upsertToken(row);
      }
    }

    await indexBondingTrades(client, store, cfg, fromBlock, toBlock);
  }

  const knownPools = Object.keys(store.data.poolToToken);
  if (knownPools.length > 0) {
    const swapLogs = await client.getLogs({
      address: cfg.poolManager,
      event: parseAbiItem(
        "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
      ),
      args: { id: knownPools as Hex[] },
      fromBlock,
      toBlock,
    });
    for (const log of swapLogs) {
      const args = log.args as {
        id: Hex;
        amount0: bigint;
        amount1: bigint;
        sqrtPriceX96: bigint;
      };
      const row = store.tokenForPool(args.id);
      if (!row || !log.transactionHash || log.blockNumber === null) continue;
      const ts = await blockTimestamp(client, log.blockNumber);
      const tokenAmt = row.tokenIsCurrency0 ? absBig(args.amount0) : absBig(args.amount1);
      const quoteAmt = row.tokenIsCurrency0 ? absBig(args.amount1) : absBig(args.amount0);
      // buy = trader receives token (pool amount for token is negative in v4 convention varies;
      // approximate: if quote amount0/1 positive into pool when buying token)
      const quoteDelta = row.tokenIsCurrency0 ? args.amount1 : args.amount0;
      const side = quoteDelta > 0n ? "buy" : "sell";
      const price = quotePerToken(args.sqrtPriceX96, row.tokenIsCurrency0);
      const trade: IndexedTrade = {
        txHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
        side,
        quoteAmount: quoteAmt.toString(),
        tokenAmount: tokenAmt.toString(),
        price: price.toString(),
        sqrtPriceX96: args.sqrtPriceX96.toString(),
      };
      store.pushTrade(row.address, trade);
    }
  }

  const tokens = Object.keys(store.data.tokens);
  for (const token of tokens) {
    const logs = await client.getLogs({
      address: token as Address,
      event: transferEvent,
      fromBlock,
      toBlock,
    });
    for (const log of logs) {
      const a = log.args as { from: Address; to: Address; value: bigint };
      store.applyTransfer(token as Address, a.from, a.to, a.value);
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

  const bought = await client.getLogs({
    address: cfg.bondingFactory,
    event: parseAbiItem(
      "event Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 tokensOut, uint256 feeQuote)",
    ),
    fromBlock,
    toBlock,
  });
  for (const log of bought) {
    const a = log.args as {
      launchId: bigint;
      quoteIn: bigint;
      tokensOut: bigint;
    };
    const token = (await readBondingLaunch(client, cfg.bondingFactory, a.launchId))?.token ?? null;
    if (!token || !log.transactionHash || log.blockNumber === null) continue;
    const row = store.getToken(token);
    if (!row) continue;
    const ts = await blockTimestamp(client, log.blockNumber);
    const price =
      a.tokensOut > 0n ? Number(a.quoteIn) / Number(a.tokensOut) : 0; // raw wei/wei; OK for relative chart
    store.pushTrade(token, {
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      timestamp: ts,
      side: "buy",
      quoteAmount: a.quoteIn.toString(),
      tokenAmount: a.tokensOut.toString(),
      price: price.toString(),
      sqrtPriceX96: "0",
    });
  }

  const sold = await client.getLogs({
    address: cfg.bondingFactory,
    event: parseAbiItem(
      "event Sold(uint256 indexed launchId, address indexed seller, uint256 tokensIn, uint256 quoteOut, uint256 feeQuote)",
    ),
    fromBlock,
    toBlock,
  });
  for (const log of sold) {
    const a = log.args as {
      launchId: bigint;
      tokensIn: bigint;
      quoteOut: bigint;
    };
    const token = (await readBondingLaunch(client, cfg.bondingFactory, a.launchId))?.token ?? null;
    if (!token || !log.transactionHash || log.blockNumber === null) continue;
    const row = store.getToken(token);
    if (!row) continue;
    const ts = await blockTimestamp(client, log.blockNumber);
    const price = a.tokensIn > 0n ? Number(a.quoteOut) / Number(a.tokensIn) : 0;
    store.pushTrade(token, {
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      timestamp: ts,
      side: "sell",
      quoteAmount: a.quoteOut.toString(),
      tokenAmount: a.tokensIn.toString(),
      price: price.toString(),
      sqrtPriceX96: "0",
    });
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
  launchedAt: number;
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
      poolId: row[12],
      launchedAt: Number(row[13]),
    };
  } catch {
    return null;
  }
}
