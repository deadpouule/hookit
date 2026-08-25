import { encodeAbiParameters, isAddress } from "viem";

import { POOL_MANAGER_ADDRESS } from "@/lib/contracts/config";
import { forgeVerifyContract, loadRepoEnv } from "@/lib/forge-env";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  loadRepoEnv();

  let body: {
    token?: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    creator?: string;
    factory?: string;
    metadataURI?: string;
    customHook?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  if (!isAddress(token)) {
    return Response.json({ error: "Invalid token address" }, { status: 400 });
  }
  if (!body.name || !body.symbol || !body.totalSupply || !body.creator || !body.factory) {
    return Response.json({ error: "Missing LaunchToken constructor fields" }, { status: 400 });
  }
  if (!isAddress(body.creator) || !isAddress(body.factory)) {
    return Response.json({ error: "Invalid creator or factory address" }, { status: 400 });
  }

  const constructorArgs = encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "string" },
    ],
    [
      body.name,
      body.symbol,
      BigInt(body.totalSupply),
      body.creator,
      body.factory,
      body.metadataURI ?? "",
    ],
  );

  try {
    const tokenResult = await forgeVerifyContract({
      address: token,
      contract: "src/LaunchToken.sol:LaunchToken",
      constructorArgsHex: constructorArgs,
    });

    let hookResult: { ok: boolean; alreadyVerified: boolean } | undefined;
    if (body.customHook && isAddress(body.customHook)) {
      const hookArgs = encodeAbiParameters([{ type: "address" }], [POOL_MANAGER_ADDRESS]);
      hookResult = await forgeVerifyContract({
        address: body.customHook,
        contract: "src/examples/HookitCustomHook.sol:HookitCustomHook",
        constructorArgsHex: hookArgs,
      });
    }

    return Response.json({
      verified: tokenResult.ok,
      alreadyVerified: tokenResult.alreadyVerified,
      hookVerified: hookResult?.ok,
      explorer: `https://sepolia.basescan.org/address/${token}#code`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
