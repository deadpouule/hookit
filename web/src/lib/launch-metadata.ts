import { clipImageForMetadata } from "@/lib/token-metadata";
import type { LaunchFormState } from "@/lib/types";

/** EIP-3860 init-code budget for LaunchToken CREATE2 (creation code + ctor args). */
export const CREATE2_INIT_CODE_LIMIT = 49_152;

/** Safe max chars for inline data: URIs — keeps ctor args well under the limit. */
export const MAX_ON_CHAIN_METADATA_URI = 8_192;

export type BuildMetadataOptions = {
  /** Prefer IPFS/HTTP URL; never embed large data:image in on-chain metadata. */
  imageUri?: string | null;
};

export type MetadataPayload = Record<string, unknown>;

/** JSON payload for IPFS / display — hook source is never embedded (too large for chain). */
export function buildMetadataPayload(
  form: LaunchFormState,
  opts: BuildMetadataOptions = {},
): MetadataPayload {
  const image = clipImageForMetadata(opts.imageUri ?? form.imagePreview);
  const payload: MetadataPayload = {
    name: form.name.trim(),
    symbol: form.ticker.trim().toUpperCase(),
    description: form.description.trim() || undefined,
    image: image || undefined,
    twitter: form.twitter.trim() || undefined,
    telegram: form.telegram.trim() || undefined,
    website: form.website.trim() || undefined,
    app: "hookit",
    version: 1,
  };

  if (form.hookMode === "custom") {
    payload.hook = {
      type: "custom",
      fileName: form.customHookFileName || undefined,
    };
  }

  return payload;
}

function encodeDataJsonUri(payload: MetadataPayload): string {
  const json = JSON.stringify(payload, (_k, v) => (v === undefined ? undefined : v));
  if (typeof window !== "undefined") {
    return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
  }
  return `data:application/json;base64,${Buffer.from(json, "utf-8").toString("base64")}`;
}

/** Minimal inline metadata when IPFS is unavailable (no embedded images). */
export function buildMinimalOnChainMetadataUri(
  form: LaunchFormState,
  imageUri?: string,
): string {
  const image = clipImageForMetadata(imageUri ?? form.imagePreview);
  const safeImage =
    image && (image.startsWith("ipfs://") || image.startsWith("https://")) ? image : undefined;

  const uri = encodeDataJsonUri({
    name: form.name.trim(),
    symbol: form.ticker.trim().toUpperCase(),
    image: safeImage,
    app: "hookit",
    version: 1,
  });

  if (uri.length > MAX_ON_CHAIN_METADATA_URI) {
    throw new Error(
      "Token metadata is too large for on-chain deploy. Shorten the name or configure IPFS (PINATA_JWT).",
    );
  }
  return uri;
}

/**
 * Resolve a short metadata URI for LaunchToken constructor / CREATE2 init code.
 * Prefers IPFS; falls back to a tiny inline JSON (no base64 images).
 */
export async function resolveOnChainMetadataUri(
  form: LaunchFormState,
  imageUri?: string,
): Promise<string> {
  const payload = buildMetadataPayload(form, { imageUri });

  try {
    const res = await fetch("/api/ipfs/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: payload }),
    });
    if (res.ok) {
      const body = (await res.json()) as { uri?: string };
      if (body.uri && body.uri.length <= MAX_ON_CHAIN_METADATA_URI) {
        return body.uri;
      }
    }
  } catch {
    // fall through to minimal inline metadata
  }

  return buildMinimalOnChainMetadataUri(form, imageUri);
}

/** @deprecated Use resolveOnChainMetadataUri for launches. */
export function buildMetadataUri(
  form: LaunchFormState,
  opts: BuildMetadataOptions = {},
): string {
  return encodeDataJsonUri(buildMetadataPayload(form, opts));
}

/** Convert a blob:/file preview into a data URL for metadata. */
export async function blobUrlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("ipfs://") || url.startsWith("https://")) {
    return url;
  }
  if (!url.startsWith("blob:")) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Upload image to Pinata when PINATA_JWT is configured; otherwise return a clipped data URL.
 */
export async function resolveLaunchImageUri(
  imagePreview: string | null,
): Promise<string | undefined> {
  if (!imagePreview) return undefined;
  const dataUrl = await blobUrlToDataUrl(imagePreview);
  if (!dataUrl) return clipImageForMetadata(imagePreview);

  try {
    const res = await fetch("/api/ipfs/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    if (res.ok) {
      const body = (await res.json()) as { uri?: string };
      if (body.uri) return body.uri;
    }
  } catch {
    // fall through — image omitted from on-chain metadata when IPFS unavailable
  }

  return undefined;
}
