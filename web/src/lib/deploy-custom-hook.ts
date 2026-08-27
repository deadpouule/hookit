import { concat, type Hex } from "viem";

import { CREATE2_DEPLOYER } from "@/lib/hook-miner";

export type PrepareHookResult = {
  address: `0x${string}`;
  salt: Hex;
  deployer: `0x${string}`;
  initCode: Hex;
  contractName: string;
};

/** Compile + mine salt on the server (no broadcast). */
export async function prepareCustomHook(source: string): Promise<PrepareHookResult> {
  const res = await fetch("/api/hooks/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const data = (await res.json()) as PrepareHookResult & { error?: string };
  if (!res.ok || !data.address || !data.salt || !data.initCode) {
    throw new Error(data.error ?? "Failed to prepare custom hook");
  }
  return {
    address: data.address,
    salt: data.salt,
    deployer: (data.deployer ?? CREATE2_DEPLOYER) as `0x${string}`,
    initCode: data.initCode,
    contractName: data.contractName,
  };
}

/**
 * Prefer wallet CREATE2 via prepare payload; fall back to server forge create
 * when the wallet path is unavailable.
 */
async function deployCustomHook(
  source: string,
  opts?: {
    sendCreate2?: (args: {
      to: `0x${string}`;
      data: Hex;
    }) => Promise<`0x${string}`>;
    waitForReceipt?: (hash: `0x${string}`) => Promise<void>;
  },
): Promise<`0x${string}`> {
  if (opts?.sendCreate2 && opts.waitForReceipt) {
    const prepared = await prepareCustomHook(source);
    const data = concat([prepared.salt, prepared.initCode]);
    const hash = await opts.sendCreate2({ to: prepared.deployer, data });
    await opts.waitForReceipt(hash);
    return prepared.address;
  }

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
