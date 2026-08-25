export type VerifyStatus = "idle" | "verifying" | "verified" | "failed";

export async function requestLaunchVerification(body: {
  token: string;
  name: string;
  symbol: string;
  totalSupply: string;
  creator: string;
  factory: string;
  metadataURI: string;
  customHook?: string;
}): Promise<{ verified: boolean; alreadyVerified?: boolean; explorer: string }> {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string; verified?: boolean; alreadyVerified?: boolean; explorer?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Verification failed");
  }
  return {
    verified: !!data.verified,
    alreadyVerified: data.alreadyVerified,
    explorer: data.explorer ?? `https://sepolia.basescan.org/address/${body.token}#code`,
  };
}
