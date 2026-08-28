import type { Address, PublicClient } from "viem";
import { zeroAddress } from "viem";

import { unpackLaunchBitmask } from "@/lib/bitmask";
import { DEFAULT_TICK_SPACING } from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { parseTokenMetadata } from "@/lib/token-metadata";
import type { TokenPool } from "@/lib/types";

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
  const { modules } = unpackLaunchBitmask(launch.bitmask);
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
      autoBurn: modules.autoBurn,
      lpDonate: modules.lpDonate,
      holderAirdrop: modules.holderAirdrop,
      creatorShareToHook: modules.creatorShareToHook,
      customHook: launch.customHook,
    },
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
  };
}

async function hydrateLaunches(
  publicClient: PublicClient,
  rows: { id: bigint; row: LaunchRow; bitmask?: bigint; launchedAt?: number; quote?: Address }[],
): Promise<OnChainLaunch[]> {
  if (rows.length === 0) return [];

  const meta = await publicClient.multicall({
    contracts: rows.flatMap(({ row }) => [
      { address: row.token, abi: erc20Abi, functionName: "name" as const },
      { address: row.token, abi: erc20Abi, functionName: "symbol" as const },
      { address: row.token, abi: erc20Abi, functionName: "metadataURI" as const },
    ]),
    allowFailure: true,
  });

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

  return rows.map(({ id, row, bitmask, launchedAt, quote }, i) => {
    const name = (meta[i * 3]?.status === "success" ? (meta[i * 3].result as string) : undefined) ?? "Unknown";
    const symbol =
      (meta[i * 3 + 1]?.status === "success" ? (meta[i * 3 + 1].result as string) : undefined) ?? "???";
    const metadataURI =
      meta[i * 3 + 2]?.status === "success" ? (meta[i * 3 + 2].result as string) : "";
    const { image } = parseTokenMetadata(metadataURI);
    let packed = bitmask ?? BigInt(0);
    if (packed === BigInt(0) && !row.customHook) {
      packed = bitmaskByIndex.get(i) ?? BigInt(0);
    }
    return {
      ...row,
      launchId: id,
      name,
      symbol,
      bitmask: packed,
      launchedAt,
      quote: quote ?? zeroAddress,
      image,
    };
  });
}

function normalizeLaunchedAt(value: number | undefined): number | undefined {
  return value && value > 1_000_000_000 ? value : undefined;
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
  return launches.reverse();
}

async function attachQuotesAndTimestamps(
  publicClient: PublicClient,
  factory: Address,
  rows: { id: bigint; row: LaunchRow; bitmask?: bigint; launchedAt?: number }[],
) {
  const [quotes, timestamps] = await Promise.all([
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
  ]);
  return rows.map((row, i) => ({
    ...row,
    quote: quotes[i]?.status === "success" ? (quotes[i].result as Address) : zeroAddress,
    launchedAt:
      row.launchedAt && row.launchedAt > 1_000_000_000
        ? row.launchedAt
        : timestamps[i]?.status === "success"
          ? normalizeLaunchedAt(Number(timestamps[i].result as bigint))
          : undefined,
  }));
}

export async function fetchAllLaunches(
  publicClient: PublicClient,
  factory: Address,
): Promise<OnChainLaunch[]> {
  const count = (await publicClient.readContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launchCount",
  })) as bigint;

  const n = Number(count);
  if (n === 0) return [];

  try {
    const page = await publicClient.readContract({
      address: factory,
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
    return launches.reverse();
  } catch {
    return fetchAllLaunchesLegacy(publicClient, factory, n);
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

function bondingRowFromResult(result: unknown): BondingLaunchRow | null {
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
  meta: { name: string; symbol: string; image?: string },
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

  const meta = await publicClient.multicall({
    contracts: rows.flatMap(({ row }) => [
      { address: row.token, abi: erc20Abi, functionName: "name" as const },
      { address: row.token, abi: erc20Abi, functionName: "symbol" as const },
      { address: row.token, abi: erc20Abi, functionName: "metadataURI" as const },
    ]),
    allowFailure: true,
  });

  return rows
    .map(({ id, row }, i) => {
      const name =
        (meta[i * 3]?.status === "success" ? (meta[i * 3].result as string) : undefined) ?? "Unknown";
      const symbol =
        (meta[i * 3 + 1]?.status === "success" ? (meta[i * 3 + 1].result as string) : undefined) ??
        "???";
      const metadataURI =
        meta[i * 3 + 2]?.status === "success" ? (meta[i * 3 + 2].result as string) : "";
      const { image } = parseTokenMetadata(metadataURI);
      return bondingToTokenPool(id, row, { name, symbol, image }, feeHook);
    })
    .reverse();
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
  const { image } = parseTokenMetadata(metadataURI as string);
  return bondingToTokenPool(
    launchId,
    row,
    {
      name: name as string,
      symbol: symbol as string,
      image,
    },
    feeHook,
  );
}
