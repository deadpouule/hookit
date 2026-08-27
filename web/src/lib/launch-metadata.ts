import { clipImageForMetadata } from "@/lib/token-metadata";
import type { LaunchFormState } from "@/lib/types";

export type BuildMetadataOptions = {
  /** Prefer IPFS/HTTP URL; small data:image allowed as fallback. */
  imageUri?: string | null;
};

/** On-chain metadata URI (data JSON). Images prefer IPFS/HTTPS. */
export function buildMetadataUri(
  form: LaunchFormState,
  opts: BuildMetadataOptions = {},
): string {
  const image = clipImageForMetadata(opts.imageUri ?? form.imagePreview);
  const payload: Record<string, unknown> = {
    name: form.name,
    description: form.description || undefined,
    image: image || undefined,
    twitter: form.twitter || undefined,
    telegram: form.telegram || undefined,
    website: form.website || undefined,
    app: "hookit",
    version: 1,
  };

  if (form.hookMode === "custom" && form.customHookSource.trim()) {
    payload.hook = {
      type: "custom",
      fileName: form.customHookFileName || undefined,
      source: form.customHookSource,
    };
  }

  const json = JSON.stringify(payload, (_k, v) => (v === undefined ? undefined : v));
  if (typeof window !== "undefined") {
    return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
  }
  return `data:application/json;base64,${Buffer.from(json, "utf-8").toString("base64")}`;
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
    // fall through to data URI
  }

  return clipImageForMetadata(dataUrl);
}
