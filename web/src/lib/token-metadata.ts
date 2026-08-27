const MAX_IMAGE_CHARS = 80_000;

export function parseTokenMetadata(uri: string): { image?: string; description?: string } {
  if (!uri) return {};
  try {
    let json = uri;
    if (uri.startsWith("data:application/json;base64,")) {
      json = Buffer.from(uri.slice("data:application/json;base64,".length), "base64").toString("utf8");
    } else if (uri.startsWith("data:application/json,")) {
      json = decodeURIComponent(uri.slice("data:application/json,".length));
    }
    const parsed = JSON.parse(json) as { image?: unknown; description?: unknown };
    const image = typeof parsed.image === "string" ? parsed.image : undefined;
    const description = typeof parsed.description === "string" ? parsed.description : undefined;
    return { image, description };
  } catch {
    return {};
  }
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
    const gateway =
      process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, "") ?? "https://ipfs.io/ipfs";
    return `${gateway}/${cid}`;
  }
  return uri;
}
