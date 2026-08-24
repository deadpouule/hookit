import type { LaunchFormState } from "@/lib/types";

/** On-chain metadata URI (data JSON). Image blobs are omitted — add IPFS later. */
export function buildMetadataUri(form: LaunchFormState): string {
  const payload = {
    name: form.name,
    description: form.description || undefined,
    twitter: form.twitter || undefined,
    telegram: form.telegram || undefined,
    website: form.website || undefined,
    app: "hookit",
    version: 1,
  };

  const json = JSON.stringify(payload, (_k, v) => (v === undefined ? undefined : v));
  if (typeof window !== "undefined") {
    return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
  }
  return `data:application/json;base64,${Buffer.from(json, "utf-8").toString("base64")}`;
}
