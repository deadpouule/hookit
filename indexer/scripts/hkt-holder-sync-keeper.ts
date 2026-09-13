/**
 * Sync HTST holders into HktHolderDropVault and run tryPush for credited launch tokens.
 *
 * HTST fair launch has holderTracker=0, so transfers do not auto-list holders.
 * This keeper backfills via indexer holders or Transfer log scan, then pushes drops.
 *
 * Env: NATIVE_TOKEN, HKT_HOLDER_DROP_VAULT, INDEXER_URL (optional), INDEXER_START_BLOCK
 */
import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { resolveInkRpcUrl } from "./rpc-env";

const INK = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-gel.inkonchain.com"] } },
} as const;

const vaultAbi = parseAbi([
  "function hkt() view returns (address)",
  "function holderCount() view returns (uint256)",
  "function potOf(address token) view returns (uint256)",
  "function syncHolders(address[] accounts)",
  "function tryPush(address token) returns (bool)",
]);

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

function envAddr(name: string): Address {
  const v = process.env[name]?.trim();
  if (!v || !isAddress(v)) throw new Error(`Set ${name}`);
  return v as Address;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function keeperKeyRaw(): string {
  return (process.env.FEE_KEEPER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchIndexerHolders(htst: Address, baseUrl: string): Promise<Address[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/tokens/${htst}/holders?limit=2000`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { holders?: { address: string }[] };
  return (body.holders ?? [])
    .map((h) => h.address?.trim())
    .filter((a): a is string => !!a && isAddress(a))
    .map((a) => a as Address);
}

async function fetchIndexerTokens(baseUrl: string): Promise<Address[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/tokens`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { tokens?: { address: string }[] };
  return (body.tokens ?? [])
    .map((t) => t.address?.trim())
    .filter((a): a is string => !!a && isAddress(a))
    .map((a) => a as Address);
}

async function scanTransferHolders(
  publicClient: ReturnType<typeof createPublicClient>,
  htst: Address,
  fromBlock: bigint,
): Promise<Address[]> {
  const latest = await publicClient.getBlockNumber();
  const chunkBlocks = 4_000n;
  const seen = new Set<string>();

  for (let start = fromBlock; start <= latest; start += chunkBlocks) {
    const end = start + chunkBlocks - 1n > latest ? latest : start + chunkBlocks - 1n;
    const logs = await publicClient.getLogs({
      address: htst,
      event: transferEvent,
      fromBlock: start,
      toBlock: end,
    });
    for (const log of logs) {
      const args = log.args as { from?: Address; to?: Address };
      if (args.from && args.from !== "0x0000000000000000000000000000000000000000") {
        seen.add(args.from.toLowerCase());
      }
      if (args.to && args.to !== "0x0000000000000000000000000000000000000000") {
        seen.add(args.to.toLowerCase());
      }
    }
  }

  return [...seen].map((a) => a as Address);
}

async function main() {
  const dryRun = envBool("HKT_SYNC_DRY_RUN", false);
  const htst = envAddr("NATIVE_TOKEN");
  const vault = envAddr("HKT_HOLDER_DROP_VAULT");
  const indexerUrl = process.env.INDEXER_URL?.trim();
  const startBlock = BigInt(process.env.INDEXER_START_BLOCK ?? "55752579");
  const batchSize = Number(process.env.HKT_SYNC_BATCH_SIZE ?? 80);

  const rpc = resolveInkRpcUrl();
  const publicClient = createPublicClient({ chain: INK, transport: http(rpc) });

  const vaultHkt = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "hkt" });
  if (vaultHkt.toLowerCase() !== htst.toLowerCase()) {
    throw new Error(`HKT_HOLDER_DROP_VAULT.hkt=${vaultHkt} != NATIVE_TOKEN=${htst} — run WireNativeHkitInk first`);
  }

  let holders = indexerUrl ? await fetchIndexerHolders(htst, indexerUrl) : [];
  if (holders.length === 0) {
    console.log("[hkt-sync] indexer holders empty — scanning Transfer logs…");
    holders = await scanTransferHolders(publicClient, htst, startBlock);
  }

  holders = [...new Set(holders.map((a) => a.toLowerCase()))].map((a) => a as Address);
  console.log(`[hkt-sync] ${holders.length} HTST holder candidate(s)`);

  const keyRaw = keeperKeyRaw();
  const account = keyRaw
    ? privateKeyToAccount((keyRaw.startsWith("0x") ? keyRaw : `0x${keyRaw}`) as Hex)
    : null;
  const walletClient = account
    ? createWalletClient({ account, chain: INK, transport: http(rpc) })
    : null;

  if (holders.length > 0) {
    if (dryRun || !walletClient) {
      console.log(`[hkt-sync] dry-run skip syncHolders (${holders.length} accounts)`);
    } else {
      for (const batch of chunk(holders, batchSize)) {
        const hash = await walletClient.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "syncHolders",
          args: [batch],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`[hkt-sync] syncHolders ok ${batch.length} ${hash}`);
      }
    }
  }

  const holderCount = await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "holderCount",
  });
  console.log("[hkt-sync] vault holderCount", holderCount.toString());

  const pushTokens = new Set<string>();
  if (indexerUrl) {
    for (const t of await fetchIndexerTokens(indexerUrl)) {
      if (t.toLowerCase() !== htst.toLowerCase()) pushTokens.add(t.toLowerCase());
    }
  }

  for (const token of pushTokens) {
    const pot = await publicClient.readContract({
      address: vault,
      abi: vaultAbi,
      functionName: "potOf",
      args: [token as Address],
    });
    if (pot === 0n) continue;
    console.log(`[hkt-sync] pot ${token} = ${pot}`);
    if (dryRun || !walletClient) {
      console.log(`[hkt-sync] dry-run skip tryPush(${token})`);
      continue;
    }
    const hash = (await walletClient.writeContract({
      address: vault,
      abi: vaultAbi,
      functionName: "tryPush",
      args: [token as Address],
    })) as Hash;
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[hkt-sync] tryPush ok ${token} ${hash}`);
  }

  console.log("[hkt-sync] HKT_SYNC_OK");
}

main().catch((err) => {
  console.error("[hkt-sync] FAILED", err);
  process.exit(1);
});
