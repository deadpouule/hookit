import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { concat, encodeAbiParameters, type Hex } from "viem";

import { POOL_MANAGER_ADDRESS } from "@/lib/contracts/config";
import { analyzeCustomHookSource } from "@/lib/custom-hook";
import { loadRepoEnv, REPO_ROOT } from "@/lib/forge-env";
import { CREATE2_DEPLOYER, mineHookSalt, parseHookFlags } from "@/lib/hook-miner";
import { prepareUserHookSource } from "@/lib/user-hook-source";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Compile + mine CREATE2 salt. Returns deploy payload for the user's wallet
 * (no server PRIVATE_KEY). Fallback remains POST /api/hooks/deploy.
 */
export async function POST(request: Request) {
  loadRepoEnv();
  let body: { source?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = body.source?.trim() ?? "";
  const analysis = analyzeCustomHookSource(source);
  if (!analysis.valid || !analysis.contractName) {
    return Response.json({ error: analysis.errors[0] ?? "Invalid hook source" }, { status: 400 });
  }

  let prepared: string;
  try {
    prepared = prepareUserHookSource(source, analysis.contractName);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Invalid source" }, { status: 400 });
  }

  const genDir = path.join(REPO_ROOT, "src", "generated");
  fs.mkdirSync(genDir, { recursive: true });
  const sourcePath = path.join(genDir, `${analysis.contractName}.sol`);
  fs.writeFileSync(sourcePath, prepared);

  try {
    await execFileAsync("forge", ["build"], {
      cwd: REPO_ROOT,
      env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: "1" },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    });

    const artifactPath = path.join(
      REPO_ROOT,
      "out",
      `${analysis.contractName}.sol`,
      `${analysis.contractName}.json`,
    );
    if (!fs.existsSync(artifactPath)) {
      return Response.json(
        { error: `Compile succeeded but artifact missing for ${analysis.contractName}` },
        { status: 500 },
      );
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
      bytecode?: { object?: string };
    };
    const bytecode = artifact.bytecode?.object;
    if (!bytecode || bytecode === "0x") {
      return Response.json({ error: "Compiled bytecode was empty" }, { status: 500 });
    }

    const constructorArgs = encodeAbiParameters([{ type: "address" }], [POOL_MANAGER_ADDRESS]);
    const flags = parseHookFlags(prepared);
    const mined = mineHookSalt(bytecode as Hex, constructorArgs, flags);
    const initCode = concat([bytecode as Hex, constructorArgs]);

    return Response.json({
      address: mined.address,
      salt: mined.salt,
      deployer: CREATE2_DEPLOYER,
      initCode,
      constructorArgs,
      contractName: analysis.contractName,
      poolManager: POOL_MANAGER_ADDRESS,
      note: "Send a CREATE2 tx from your wallet to `deployer` with data = salt + initCode.",
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: string }).stderr || (err as { message?: string }).message)
        : err instanceof Error
          ? err.message
          : "Forge compile failed";
    return Response.json({ error: message.slice(0, 2000) }, { status: 500 });
  }
}
