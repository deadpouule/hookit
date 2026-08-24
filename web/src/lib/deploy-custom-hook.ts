import type { LaunchFormState } from "@/lib/types";

/** On-chain metadata URI (data JSON). Image blobs are omitted — add IPFS later. */
export function buildMetadataUri(form: LaunchFormState): string {
  const payload: Record<string, unknown> = {
    name: form.name,
    description: form.description || undefined,
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

async function deployCustomHook(source: string): Promise<`0x${string}`> {
  const res = await fetch("/api/hooks/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });

  const data = (await res.json()) as { address?: string; error?: string };
  if (!res.ok || !data.address) {
    throw new Error(data.error ?? "Failed to deploy custom hook");
  }
  return data.address as `0x${string}`;
}

export { deployCustomHook };
