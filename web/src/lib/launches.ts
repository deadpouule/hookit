import type { Address, PublicClient } from "viem";
import { zeroAddress } from "viem";

import { unpackLaunchBitmask } from "@/lib/bitmask";
import {
  DEFAULT_TICK_SPACING,
  getLaunchFactoryPairs,
  getLaunchFactoryQueryAddress,
} from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { resolveTokenMetadata } from "@/lib/token-metadata";
import { isPlaceholderLaunchName, isPlaceholderLaunchTicker } from "@/lib/token-identity";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";

const GRADIENTS = [
  "linear-gradient(135deg, #0a0a0f 0%, #1a1028 45%, #0c0c10 100%)",
  "linear-gradient(145deg, #050505 0%, #1e1030 50%, #0a0812 100%)",
  "linear-gradient(160deg, #08080c 0%, #2d1b4e 40%, #050505 100%)",
  "linear-gradient(135deg, #0c0a10 0%, #3b1d5c 35%, #0a0a0f 100%)",
  "linear-gradient(150deg, #050505 0%, #1a0f2e 55%, #12101a 100%)",
];

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function gradientForAddress(address: string): string {
  const n = address.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

export type LaunchRow = {
  token: Address;
  creator: Address;
  hooks: Address;
  customHook: boolean;
  poolId: `0x${string}`;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
};

export type OnChainLaunch = LaunchRow & {
  launchId: bigint;
  name: string;
  symbol: string;
  bitmask: bigint;
  launchedAt?: number;
  tickSpacing?: number;
  fee?: number;
  quote?: Address;
  image?: string;
  description?: string;
  twitter?: string;
  website?: string;
  github?: string;
  marketCount?: number;
  markets?: TokenPoolMarket[];
};

function rowFromResult(result: unknown): LaunchRow | null {
  if (!result) return null;
  if (Array.isArray(result)) {
    const [token, creator, hooks, customHook, poolId, tickLower, tickUpper, liquidity] =
      result as [
        Address,
        Address,
        Address,
        boolean,
        `0x${string}`,
        number,
        number,
        bigint,
      ];
    if (!token || token === zeroAddress) return null;
    return { token, creator, hooks, customHook, poolId, tickLower, tickUpper, liquidity };
  }
  const r = result as LaunchRow;
  if (!r.token || r.token === zeroAddress) return null;
  return r;
}

export function launchToTokenPool(launch: OnChainLaunch): TokenPool {
  const { modules, hookTaxBps } = unpackLaunchBitmask(launch.bitmask);
  const token = launch.token.toLowerCase() as Address;
  const quote = (launch.quote ?? zeroAddress).toLowerCase() as Address;
  const tokenIsCurrency0 = BigInt(launch.token) < BigInt(quote);
  const quoteLabel = poolQuoteLabel({
    quoteAddress: quote,
  } as TokenPool);

  return {
    id: token,
    name: launch.name,
    ticker: launch.symbol,
    image: launch.image ?? "",
    description: launch.description,
    twitter: launch.twitter,
    website: launch.website,
    github: launch.github,
    banner: "",
    marketCap: 0,
    floorValue: 0,
    liquidity: 0,
    change24h: 0,
    hooks: {
      antiSnipe: modules.antiSnipe,
      backedFloor: modules.backedFloor,
      antiMev: modules.antiMev,
      maxTx: modules.maxTx,
      maxWallet: modules.maxWallet,
      dynamicFees: modules.dynamicFees,
      buybackVesting: modules.buybackVesting,
      autoBurn: modules.autoBurn,
      lpDonate: modules.lpDonate,
      holderAirdrop: modules.holderAirdrop,
      creatorShareToHook: modules.creatorShareToHook,
      customHook: launch.customHook,
    },
    modules: launch.customHook ? undefined : modules,
    hookTaxBps: launch.customHook ? undefined : hookTaxBps,
    bitmask: launch.customHook ? undefined : launch.bitmask.toString(),
    address: shortenAddress(token),
    quoteAsset: quoteLabel,
    hookType: launch.customHook ? "Custom" : "Master",
    bannerGradient: gradientForAddress(token),
    contractAddress: launch.token,
    poolId: launch.poolId,
    tokenIsCurrency0,
    priceEth: 0,
    volume24h: 0,
    creator: launch.creator,
    launchId: Number(launch.launchId),
    launchedAt: launch.launchedAt && launch.launchedAt > 1_000_000_000 ? launch.launchedAt : undefined,
    hooksAddress: launch.hooks,
    quoteAddress: quote,
    tickSpacing: launch.tickSpacing ?? DEFAULT_TICK_SPACING,
    lpFee: launch.fee ?? 0,
    tickLower: launch.tickLower,
    tickUpper: launch.tickUpper,
    liquidityRaw: launch.liquidity.toString(),
    rail: "master",
    marketCount: launch.marketCount,
    markets: launch.markets,
  };
}

async function attachLaunchMarkets(
  publicClient: PublicClient,
  factory: Address,
  launches: OnChainLaunch[],
): Promise<void> {
  if (launches.length === 0) return;

  const countResults = await publicClient.multicall({
    contracts: launches.map((launch) => ({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launchMarketCount" as const,
      args: [launch.launchId] as const,
    })),
    allowFailure: true,
  });

  const jobs: { launch: OnChainLaunch; index: number }[] = [];
  launches.forEach((launch, i) => {
    const count =
      countResults[i]?.status === "success" ? Number(countResults[i].result as number) : 0;
    launch.marketCount = count > 0 ? count : 1;
    if (count > 1) {
      for (let index = 0; index < count; index += 1) {
        jobs.push({ launch, index });
      }
    }
  });

  if (jobs.length === 0) return;

  const marketResults = await publicClient.multicall({
    contracts: jobs.map(({ launch, index }) => ({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launchMarkets" as const,
      args: [launch.launchId, BigInt(index)] as const,
    })),
    allowFailure: true,
  });

  const marketsByLaunch = new Map<string, TokenPoolMarket[]>();
  jobs.forEach(({ launch, index }, i) => {
    const result = marketResults[i];
    if (result?.status !== "success" || !result.result) return;
    const [quote, bps, poolId] = result.result as readonly [
      Address,
      number,
      `0x${string}`,
      number,
      number,
      bigint,
    ];
    const key = launch.launchId.toString();
    const list = marketsByLaunch.get(key) ?? [];
    const quoteAddress = quote as `0x${string}`;
    list.push({
      quoteAddress,
      quoteAsset: poolQuoteLabel({ quoteAddress } as TokenPool),
      bps: Number(bps),
      poolId,
    });
    marketsByLaunch.set(key, list);
  });

  for (const launch of launches) {
    const markets = marketsByLaunch.get(launch.launchId.toString());
    if (markets?.length) launch.markets = markets;
  }
}

function metaString(entry: { status: string; result?: unknown } | undefined): string {
  if (entry?.status !== "success" || typeof entry.result !== "string") return "";
  return entry.result.trim();
}

async function readLaunchTokenMeta(
  publicClient: PublicClient,
  tokens: Address[],
): Promise<{ name: string; symbol: string; metadataURI: string }[]> {
  if (tokens.length === 0) return [];

  const readPage = (addrs: Address[]) =>
    publicClient.multicall({
      contracts: addrs.flatMap((address) => [
        { address, abi: erc20Abi, functionName: "name" as const },
        { address, abi: erc20Abi, functionName: "symbol" as const },
        { address, abi: erc20Abi, functionName: "metadataURI" as const },
      ]),
      allowFailure: true,
    });

  const meta = await readPage(tokens);
  const out = tokens.map((_, i) => {
    const name = metaString(meta[i * 3]);
    const symbol = metaString(meta[i * 3 + 1]);
    return {
      name: isPlaceholderLaunchName(name) ? "" : name,
      symbol: isPlaceholderLaunchTicker(symbol) ? "" : symbol,
      metadataURI: metaString(meta[i * 3 + 2]),
    };
  });

  const retryIdx = out
    .map((row, i) => (row.name && row.symbol ? -1 : i))
    .filter((i) => i >= 0);
  if (retryIdx.length === 0) return out;

  const retryMeta = await readPage(retryIdx.map((i) => tokens[i]!));
  retryIdx.forEach((rowIndex, j) => {
    const name = metaString(retryMeta[j * 3]);
    const symbol = metaString(retryMeta[j * 3 + 1]);
    const uri = metaString(retryMeta[j * 3 + 2]);
    const row = out[rowIndex]!;
    if (!row.name && name && !isPlaceholderLaunchName(name)) row.name = name;
    if (!row.symbol && symbol && !isPlaceholderLaunchTicker(symbol)) row.symbol = symbol;
    if (!row.metadataURI && uri) row.metadataURI = uri;
  });

  return out;
}

async function hydrateLaunches(
  publicClient: PublicClient,
  rows: {
    id: bigint;
    row: LaunchRow;
    bitmask?: bigint;
    launchedAt?: number;
    quote?: Address;
    fee?: number;
    tickSpacing?: number;
  }[],
): Promise<OnChainLaunch[]> {
  if (rows.length === 0) return [];

  const identities = await readLaunchTokenMeta(
    publicClient,
    rows.map(({ row }) => row.token),
  );

  const configJobs = rows
    .map(({ row }, index) =>
      row.customHook
        ? null
        : {
            index,
            contract: {
              address: row.hooks,
              abi: masterLaunchHookAbi,
              functionName: "configs" as const,
              args: [row.poolId] as const,
            },
          },
    )
    .filter((j): j is { index: number; contract: NonNullable<typeof j>["contract"] } => j !== null);

  const configs =
    configJobs.length > 0
      ? await publicClient.multicall({
          contracts: configJobs.map((j) => j.contract),
          allowFailure: true,
        })
      : [];

  const bitmaskByIndex = new Map<number, bigint>();
  configJobs.forEach((job, j) => {
    if (configs[j]?.status === "success") {
      bitmaskByIndex.set(job.index, configs[j].result as bigint);
    }
  });

  return Promise.all(
    rows.map(async ({ id, row, bitmask, launchedAt, quote, fee, tickSpacing }, i) => {
      const identity = identities[i] ?? { name: "", symbol: "", metadataURI: "" };
      const { image, description, twitter, website, github } = await resolveTokenMetadata(
        identity.metadataURI,
      );
      let packed = bitmask ?? BigInt(0);
      if (packed === BigInt(0) && !row.customHook) {
        packed = bitmaskByIndex.get(i) ?? BigInt(0);
      }
      return {
        ...row,
        launchId: id,
        name: identity.name,
        symbol: identity.symbol,
        bitmask: packed,
        launchedAt,
        quote: quote ?? zeroAddress,
        fee,
        tickSpacing,
        image,
        description,
        twitter,
        website,
        github,
      };
    }),
  );
}

function normalizeLaunchedAt(value: number | undefined): number | undefined {
  return value && value > 1_000_000_000 ? value : undefined;
}

/** Numeric launch ids are per-factory; try the active factory first. */
export async function fetchLaunchByNumericId(
  publicClient: PublicClient,
  launchId: bigint,
): Promise<OnChainLaunch | null> {
  for (const { factory } of getLaunchFactoryPairs()) {
    const launch = await fetchLaunchById(publicClient, factory, launchId);
    if (launch) return launch;
  }
  return null;
}

export async function fetchLaunchById(
  publicClient: PublicClient,
  factory: Address,
  launchId: bigint,
): Promise<OnChainLaunch | null> {
  if (launchId === BigInt(0)) return null;

  const raw = await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launches",
    args: [launchId],
  });
  const row = rowFromResult(raw);
  if (!row) return null;

  let launchedAt: number | undefined;
  try {
    const ts = (await publicClient.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launchedAt",
      args: [launchId],
    })) as bigint;
    launchedAt = normalizeLaunchedAt(Number(ts));
  } catch {
    launchedAt = undefined;
  }

  const [hydrated] = await hydrateLaunches(publicClient, [
    { id: launchId, row, launchedAt },
  ]);
  if (!hydrated) return null;
  await attachLaunchMarkets(publicClient, factory, [hydrated]);
  try {
    const quote = (await publicClient.readContract({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launchQuote",
      args: [launchId],
    })) as Address;
    return { ...hydrated, quote };
  } catch {
    return hydrated;
  }
}

async function fetchAllLaunchesLegacy(
  publicClient: PublicClient,
  factory: Address,
  count: number,
): Promise<OnChainLaunch[]> {
  const results = await publicClient.multicall({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: factory,
      abi: launchFactoryAbi,
      functionName: "launches" as const,
      args: [BigInt(i + 1)] as const,
    })),
    allowFailure: true,
  });

  const rows = results
    .map((r, i) => {
      if (r.status !== "success") return null;
      const row = rowFromResult(r.result);
      if (!row) return null;
      return { id: BigInt(i + 1), row };
    })
    .filter((x): x is { id: bigint; row: LaunchRow } => x !== null);

  const withMeta = await attachQuotesAndTimestamps(publicClient, factory, rows);
  const launches = await hydrateLaunches(publicClient, withMeta);
  await attachLaunchMarkets(publicClient, factory, launches);
  return launches.reverse();
}

async function attachQuotesAndTimestamps(
  publicClient: PublicClient,
  factory: Address,
  rows: { id: bigint; row: LaunchRow; bitmask?: bigint; launchedAt?: number }[],
) {
  const [quotes, timestamps, poolKeys] = await Promise.all([
    publicClient.multicall({
      contracts: rows.map(({ id }) => ({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "launchQuote" as const,
        args: [id] as const,
      })),
      allowFailure: true,
    }),
    publicClient.multicall({
      contracts: rows.map(({ id }) => ({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "launchedAt" as const,
        args: [id] as const,
      })),
      allowFailure: true,
    }),
    publicClient.multicall({
      contracts: rows.map(({ id }) => ({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "poolKeyOf" as const,
        args: [id] as const,
      })),
      allowFailure: true,
    }),
  ]);
  return rows.map((row, i) => {
    const key =
      poolKeys[i]?.status === "success"
        ? (poolKeys[i].result as {
            currency0: Address;
            currency1: Address;
            fee: number;
            tickSpacing: number;
            hooks: Address;
          })
        : null;
    return {
      ...row,
      quote: quotes[i]?.status === "success" ? (quotes[i].result as Address) : zeroAddress,
      launchedAt:
        row.launchedAt && row.launchedAt > 1_000_000_000
          ? row.launchedAt
          : timestamps[i]?.status === "success"
            ? normalizeLaunchedAt(Number(timestamps[i].result as bigint))
            : undefined,
      fee: key ? Number(key.fee) : undefined,
      tickSpacing: key ? Number(key.tickSpacing) : undefined,
    };
  });
}

/** Which Master factory registered this token (active first, then previous). */
export async function resolveMasterLaunch(
  publicClient: PublicClient,
  token: Address,
): Promise<{ factory: Address; launchId: bigint } | null> {
  for (const { factory } of getLaunchFactoryPairs()) {
    try {
      const launchId = (await publicClient.readContract({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "tokenLaunchId",
        args: [token],
      })) as bigint;
      if (launchId > BigInt(0)) return { factory, launchId };
    } catch {
      /* factory missing getter or RPC blip */
    }
  }
  return null;
}

/** Catalog across the active factory and any previous Ink factory that still holds live tokens. */
export async function fetchAllMasterLaunches(
  publicClient: PublicClient,
): Promise<OnChainLaunch[]> {
  const seen = new Set<string>();
  const out: OnChainLaunch[] = [];
  for (const { factory, query } of getLaunchFactoryPairs()) {
    const batch = await fetchAllLaunches(publicClient, factory, query);
    for (const launch of batch) {
      const key = launch.token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(launch);
    }
  }
  out.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
  return out;
}

export async function fetchAllLaunches(
  publicClient: PublicClient,
  factory: Address,
  queryAddress?: Address,
): Promise<OnChainLaunch[]> {
  const count = (await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launchCount",
  })) as bigint;

  const n = Number(count);
  if (n === 0) return [];

  try {
    const pair = getLaunchFactoryPairs().find(
      (p) => p.factory.toLowerCase() === factory.toLowerCase(),
    );
    const query = queryAddress ?? pair?.query ?? getLaunchFactoryQueryAddress() ?? factory;
    const page = await publicClient.readContract({
      address: query,
      abi: launchFactoryAbi,
      functionName: "getLaunchPage",
      args: [BigInt(1), count],
    });
    const infos = page[0];
    const bitmasks = page[1];
    const timestamps = page[2];
    const rows = infos.map((row, i) => ({
      id: BigInt(i + 1),
      row,
      bitmask: bitmasks[i] ?? BigInt(0),
      launchedAt: normalizeLaunchedAt(Number(timestamps[i] ?? 0)),
    }));
    const withQuotes = await attachQuotesAndTimestamps(publicClient, factory, rows);
    const launches = await hydrateLaunches(publicClient, withQuotes);
    await attachLaunchMarkets(publicClient, factory, launches);
    return launches.reverse();
  } catch {
    const legacy = await fetchAllLaunchesLegacy(publicClient, factory, n);
    await attachLaunchMarkets(publicClient, factory, legacy);
    return legacy;
  }
}

export type BondingLaunchRow = {
  token: Address;
  creator: Address;
  quote: Address;
  phase: number;
  /** Deprecated on-chain field — Classic always stores 0. */
  creatorTaxBps: number;
  totalSupply: bigint;
  curveSupply: bigint;
  tokensSold: bigint;
  realQuote: bigint;
  virtualQuote: bigint;
  virtualToken: bigint;
  graduationQuote: bigint;
  poolId: `0x${string}`;
  launchedAt: number;
  graduatedAt: number;
};

export function bondingRowFromResult(result: unknown): BondingLaunchRow | null {
  if (!result || !Array.isArray(result)) return null;
  const [
    token,
    creator,
    quote,
    phase,
    creatorTaxBps,
    totalSupply,
    curveSupply,
    tokensSold,
    realQuote,
    virtualQuote,
    virtualToken,
    graduationQuote,
    poolId,
    launchedAt,
    graduatedAt,
  ] = result as [
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
    `0x${string}`,
    bigint,
    bigint,
  ];
  if (!token || token === zeroAddress) return null;
  return {
    token,
    creator,
    quote,
    phase: Number(phase),
    creatorTaxBps: Number(creatorTaxBps),
    totalSupply,
    curveSupply,
    tokensSold,
    realQuote,
    virtualQuote,
    virtualToken,
    graduationQuote,
    poolId,
    launchedAt: Number(launchedAt),
    graduatedAt: Number(graduatedAt),
  };
}

/** Classic pools use GraduatedFeeHook with fee=0 / tickSpacing=60 (BondingConstants). */
export function bondingToTokenPool(
  launchId: bigint,
  row: BondingLaunchRow,
  meta: {
    name: string;
    symbol: string;
    image?: string;
    description?: string;
    twitter?: string;
    website?: string;
    github?: string;
  },
  feeHook?: Address,
): TokenPool {
  const token = row.token.toLowerCase() as Address;
  const quote = (row.quote ?? zeroAddress).toLowerCase() as Address;
  const tokenIsCurrency0 = BigInt(row.token) < BigInt(quote);
  const quoteLabel = poolQuoteLabel({ quoteAddress: quote } as TokenPool);
  const zeroPool =
    row.poolId === "0x0000000000000000000000000000000000000000000000000000000000000000";
  const graduated = row.phase !== 0;

  return {
    id: token,
    name: meta.name,
    ticker: meta.symbol,
    image: meta.image ?? "",
    description: meta.description,
    twitter: meta.twitter,
    website: meta.website,
    github: meta.github,
    banner: "",
    marketCap: 0,
    floorValue: 0,
    // Temporarily hold quote ETH; enrichPoolsWithSpotPrices converts to USD.
    liquidity: Number(row.realQuote) / 1e18,
    change24h: 0,
    hooks: {
      antiSnipe: false,
      backedFloor: false,
      antiMev: false,
      customHook: false,
    },
    address: shortenAddress(token),
    quoteAsset: quoteLabel,
    hookType: "Classic",
    bannerGradient: gradientForAddress(token),
    contractAddress: row.token,
    poolId: zeroPool ? undefined : row.poolId,
    tokenIsCurrency0,
    priceEth: 0,
    volume24h: 0,
    creator: row.creator,
    launchId: Number(launchId),
    launchedAt: row.launchedAt > 1_000_000_000 ? row.launchedAt : undefined,
    // Always attach GraduatedFeeHook so post-bonding swaps can build a PoolKey.
    hooksAddress: feeHook && feeHook !== zeroAddress ? feeHook : undefined,
    quoteAddress: quote,
    tickSpacing: DEFAULT_TICK_SPACING,
    lpFee: 0,
    // Graduated Classic uses full-range LP (spacing 60).
    tickLower: graduated ? -887220 : undefined,
    tickUpper: graduated ? 887220 : undefined,
    liquidityRaw: undefined,
    rail: "classic",
    bondingPhase: row.phase,
    tokensSold: row.tokensSold.toString(),
    graduationQuote: row.graduationQuote.toString(),
    realQuote: row.realQuote.toString(),
  };
}

export async function fetchAllBondingLaunches(
  publicClient: PublicClient,
  bonding: Address,
): Promise<TokenPool[]> {
  const count = (await publicClient.readContract({
    address: bonding,
    abi: bondingFactoryAbi,
    functionName: "launchCount",
  })) as bigint;
  const n = Number(count);
  if (n === 0) return [];

  const [feeHook, results] = await Promise.all([
    publicClient
      .readContract({
        address: bonding,
        abi: bondingFactoryAbi,
        functionName: "feeHook",
      })
      .catch(() => zeroAddress) as Promise<Address>,
    publicClient.multicall({
      contracts: Array.from({ length: n }, (_, i) => ({
        address: bonding,
        abi: bondingFactoryAbi,
        functionName: "launches" as const,
        args: [BigInt(i + 1)] as const,
      })),
      allowFailure: true,
    }),
  ]);

  const rows = results
    .map((r, i) => {
      if (r.status !== "success") return null;
      const row = bondingRowFromResult(r.result);
      if (!row) return null;
      return { id: BigInt(i + 1), row };
    })
    .filter((x): x is { id: bigint; row: BondingLaunchRow } => x !== null);

  if (rows.length === 0) return [];

  const identities = await readLaunchTokenMeta(
    publicClient,
    rows.map(({ row }) => row.token),
  );

  return Promise.all(
    rows.map(async ({ id, row }, i) => {
      const identity = identities[i] ?? { name: "", symbol: "", metadataURI: "" };
      const fields = await resolveTokenMetadata(identity.metadataURI);
      return bondingToTokenPool(
        id,
        row,
        { name: identity.name, symbol: identity.symbol, ...fields },
        feeHook,
      );
    }),
  ).then((pools) => pools.reverse());
}

export async function fetchBondingLaunchById(
  publicClient: PublicClient,
  bonding: Address,
  launchId: bigint,
): Promise<TokenPool | null> {
  if (launchId === BigInt(0)) return null;
  const [raw, feeHook] = await Promise.all([
    publicClient.readContract({
      address: bonding,
      abi: bondingFactoryAbi,
      functionName: "launches",
      args: [launchId],
    }),
    publicClient
      .readContract({
        address: bonding,
        abi: bondingFactoryAbi,
        functionName: "feeHook",
      })
      .catch(() => zeroAddress) as Promise<Address>,
  ]);
  const row = bondingRowFromResult(raw);
  if (!row) return null;

  const [name, symbol, metadataURI] = await Promise.all([
    publicClient.readContract({ address: row.token, abi: erc20Abi, functionName: "name" }),
    publicClient.readContract({ address: row.token, abi: erc20Abi, functionName: "symbol" }),
    publicClient
      .readContract({ address: row.token, abi: erc20Abi, functionName: "metadataURI" })
      .catch(() => ""),
  ]);
  const fields = await resolveTokenMetadata(metadataURI as string);
  return bondingToTokenPool(
    launchId,
    row,
    {
      name: name as string,
      symbol: symbol as string,
      ...fields,
    },
    feeHook,
  );
}
