import { resolveHookitChainKey } from "@/lib/chains";
import { clampBuybackVestingMcapUsd, clampHolderAirdropMcapUsd } from "@/lib/constants";
import type { McapUnlockMode } from "@/lib/mcap-vest";

const MAX_IMAGE_CHARS = 80_000;

export type TokenMetadataFields = {
  image?: string;
  description?: string;
  twitter?: string;
  website?: string;
  github?: string;
  /** USD FDV that unlocks buyback vesting when the launcher picked until-mcap. */
  buybackVestingMcapUsd?: number;
  buybackVestingUnlockMode?: McapUnlockMode;
  buybackVestingStepPct?: number[];
  holderAirdropMcapUsd?: number;
  holderAirdropUnlockMode?: McapUnlockMode;
  holderAirdropStepPct?: number[];
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

const IPFS_GATEWAY_FALLBACKS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, ""),
  DEFAULT_IPFS_GATEWAY,
  "https://cloudflare-ipfs.com/ipfs",
  "https://ipfs.io/ipfs",
].filter((g): g is string => Boolean(g));

/** Block SSRF: no localhost / RFC1918 / link-local / metadata IPs; https or known IPFS gateways only. */
export function isSafeRemoteMetadataUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }
  if (isPrivateOrReservedHost(host)) return false;
  if (protocol === "http:") {
    return IPFS_GATEWAY_FALLBACKS.some((g) => raw.startsWith(`${g}/`));
  }
  return true;
}

function isPrivateOrReservedHost(host: string): boolean {
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 0 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  if (host.includes(":")) {
    const h = host.toLowerCase();
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  }
  return false;
}

function ipfsHttpUrls(uri: string): string[] {
  if (!uri.startsWith("ipfs://")) return [uri];
  const cid = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const base of IPFS_GATEWAY_FALLBACKS) {
    const url = `${base}/${cid}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

const remoteMetaCache = new Map<string, TokenMetadataFields>();

/** True when a string looks like a renderable image / media URI. */
export function isTokenMediaUri(value: string | undefined | null): boolean {
  if (!value) return false;
  return (
    value.startsWith("ipfs://") ||
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:image/")
  );
}

/** Sync parse for inline `data:application/json` metadata URIs. */
export function parseTokenMetadata(uri: string): TokenMetadataFields {
  if (!uri) return {};
  try {
    let json = uri;
    if (uri.startsWith("data:application/json;base64,")) {
      json = Buffer.from(uri.slice("data:application/json;base64,".length), "base64").toString("utf8");
    } else if (uri.startsWith("data:application/json,")) {
      json = decodeURIComponent(uri.slice("data:application/json,".length));
    } else if (uri.startsWith("ipfs://") || uri.startsWith("https://") || uri.startsWith("http://")) {
      // Remote metadata needs resolveTokenMetadata (async fetch).
      return {};
    }
    return fieldsFromUnknown(JSON.parse(json));
  } catch {
    return {};
  }
}

function parseUsd(raw: unknown, clamp: (n: number) => number): number | undefined {
  const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  const clamped = clamp(num);
  return clamped > 0 ? clamped : undefined;
}

function parseUnlockMode(raw: unknown): McapUnlockMode | undefined {
  return raw === "steps" || raw === "all" ? raw : undefined;
}

function parseStepPct(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((n) => {
    const num = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  });
}

function fieldsFromUnknown(parsed: unknown): TokenMetadataFields {
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as Record<string, unknown>;
  const buybackVestingMcapUsd = parseUsd(record.buybackVestingMcapUsd, clampBuybackVestingMcapUsd);
  const holderAirdropMcapUsd = parseUsd(record.holderAirdropMcapUsd, clampHolderAirdropMcapUsd);
  const buybackVestingUnlockMode = parseUnlockMode(record.buybackVestingUnlockMode);
  const holderAirdropUnlockMode = parseUnlockMode(record.holderAirdropUnlockMode);
  const buybackVestingStepPct = parseStepPct(record.buybackVestingStepPct);
  const holderAirdropStepPct = parseStepPct(record.holderAirdropStepPct);
  return {
    image: typeof record.image === "string" ? record.image : undefined,
    description: str(record.description),
    twitter: str(record.twitter),
    website: str(record.website),
    github: str(record.github),
    buybackVestingMcapUsd,
    buybackVestingUnlockMode,
    buybackVestingStepPct,
    holderAirdropMcapUsd,
    holderAirdropUnlockMode,
    holderAirdropStepPct,
  };
}

/** Normalize a creator-entered GitHub handle / repo path / URL into an absolute link. */
export function tokenGithubUrl(value: string | undefined | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.replace(/^@/, "").replace(/^(?:www\.)?github\.com\//i, "").replace(/\/+$/, "");
  if (!path) return undefined;
  return `https://github.com/${path}`;
}

/** Normalize a creator-entered X handle / URL into an absolute link. */
export function tokenTwitterUrl(value: string | undefined | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^(?:www\.)?(?:x|twitter)\.com\//i, "").replace(/\/+$/, "");
  if (!handle) return undefined;
  return `https://x.com/${handle}`;
}

/** Uniswap web app swap for this token (already listed on the active chain). */
export function uniswapSwapUrl(
  tokenAddress: string | undefined | null,
  quoteAddress?: string | null,
): string | undefined {
  const token = tokenAddress?.trim();
  if (!token || !/^0x[a-fA-F0-9]{40}$/.test(token)) return undefined;
  const chain = resolveHookitChainKey() === "ink" ? "ink" : "base_sepolia";
  const params = new URLSearchParams({
    chain,
    outputCurrency: token,
    inputCurrency:
      quoteAddress && quoteAddress !== "0x0000000000000000000000000000000000000000"
        ? quoteAddress
        : "NATIVE",
  });
  return `https://app.uniswap.org/swap?${params.toString()}`;
}

/** Normalize a creator-entered website into an absolute link. */
export function tokenWebsiteUrl(value: string | undefined | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

/**
 * Resolve LaunchToken.metadataURI to image/description.
 * Handles inline data: JSON and remote ipfs:// / https:// metadata documents.
 */
export async function resolveTokenMetadata(uri: string): Promise<TokenMetadataFields> {
  if (!uri) return {};

  if (uri.startsWith("data:application/json")) {
    return parseTokenMetadata(uri);
  }

  if (uri.startsWith("data:image/")) {
    return { image: uri };
  }

  if (uri.startsWith("ipfs://") || uri.startsWith("https://") || uri.startsWith("http://")) {
    const cached = remoteMetaCache.get(uri);
    if (cached) return cached;

    for (const httpUrl of ipfsHttpUrls(uri)) {
      if (!isSafeRemoteMetadataUrl(httpUrl)) continue;
      try {
        const res = await fetch(httpUrl, {
          signal: AbortSignal.timeout(8_000),
          headers: { Accept: "application/json, image/*, */*" },
        });
        if (!res.ok) continue;

        const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
        if (contentType.startsWith("image/")) {
          const fields = { image: uri };
          remoteMetaCache.set(uri, fields);
          return fields;
        }

        const text = await res.text();
        try {
          const fields = fieldsFromUnknown(JSON.parse(text));
          remoteMetaCache.set(uri, fields);
          return fields;
        } catch {
          continue;
        }
      } catch {
        continue;
      }
    }

    remoteMetaCache.set(uri, {});
    return {};
  }

  return parseTokenMetadata(uri);
}

export function clipImageForMetadata(image: string | null | undefined): string | undefined {
  if (!image || image.startsWith("blob:")) return undefined;
  if (image.length > MAX_IMAGE_CHARS) return undefined;
  if (image.startsWith("data:image/") || image.startsWith("ipfs://") || image.startsWith("https://")) {
    return image;
  }
  return undefined;
}

/** Resolve ipfs:// to an HTTP gateway URL for <img src>. */
export function resolveMediaUrl(uri: string | undefined | null): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith("ipfs://")) {
    const cid = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    const gateway = IPFS_GATEWAY_FALLBACKS[0] ?? DEFAULT_IPFS_GATEWAY;
    return `${gateway}/${cid}`;
  }
  return uri;
}
