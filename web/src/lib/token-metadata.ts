const MAX_IMAGE_CHARS = 80_000;

export type TokenMetadataFields = {
  image?: string;
  description?: string;
};

const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

const IPFS_GATEWAY_FALLBACKS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, ""),
  DEFAULT_IPFS_GATEWAY,
  "https://cloudflare-ipfs.com/ipfs",
  "https://ipfs.io/ipfs",
].filter((g): g is string => Boolean(g));

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
    const parsed = JSON.parse(json) as { image?: unknown; description?: unknown };
    const image = typeof parsed.image === "string" ? parsed.image : undefined;
    const description = typeof parsed.description === "string" ? parsed.description : undefined;
    return { image, description };
  } catch {
    return {};
  }
}

function fieldsFromUnknown(parsed: unknown): TokenMetadataFields {
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as { image?: unknown; description?: unknown };
  return {
    image: typeof record.image === "string" ? record.image : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
  };
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
