import type { LaunchFormState } from "@/lib/types";
import { clipImageForMetadata } from "@/lib/token-metadata";

/** On-chain metadata URI (data JSON). Small logos are inlined as data URIs. */
export function buildMetadataUri(form: LaunchFormState): string {
  const payload: Record<string, unknown> = {
    name: form.name,
    description: form.description || undefined,
    image: clipImageForMetadata(form.imagePreview),
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
