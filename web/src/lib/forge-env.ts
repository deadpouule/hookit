import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { getActiveChainId } from "@/lib/chains";
import { getChainDeployment } from "@/lib/contracts/config";

const execFileAsync = promisify(execFile);

function resolveRepoRoot(): string {
  const explicit = process.env.HOOKIT_REPO_ROOT?.trim();
  if (explicit && fs.existsSync(path.join(explicit, "src", "LaunchToken.sol"))) {
    return path.resolve(explicit);
  }
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "src", "LaunchToken.sol"))) return cwd;
  const parent = path.resolve(cwd, "..");
  if (fs.existsSync(path.join(parent, "src", "LaunchToken.sol"))) return parent;
  const grand = path.resolve(cwd, "../..");
  if (fs.existsSync(path.join(grand, "src", "LaunchToken.sol"))) return grand;
  return parent;
}

export const REPO_ROOT = resolveRepoRoot();

/** Load repo-root `.env` into process.env without overwriting existing keys. */
export function loadRepoEnv() {
  const envPath = path.join(REPO_ROOT, ".env");
  try {
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

export function explorerApiKey(): string | undefined {
  loadRepoEnv();
  const deployment = getChainDeployment();
  if (deployment.chainId === 57073) {
    const ink = process.env.INK_EXPLORER_API_KEY?.trim();
    if (ink) return ink;
  }
  const key = process.env.BASESCAN_API_KEY?.trim();
  return key || undefined;
}

/** @deprecated use explorerApiKey */
export function basescanApiKey(): string | undefined {
  return explorerApiKey();
}

export async function forgeVerifyContract(opts: {
  address: string;
  contract: string;
  constructorArgsHex?: string;
}): Promise<{ ok: boolean; alreadyVerified: boolean; output: string }> {
  const apiKey = explorerApiKey();
  const chainId = String(getActiveChainId());

  const baseArgs = [
    "verify-contract",
    opts.address,
    opts.contract,
    "--root",
    REPO_ROOT,
    "--chain",
    chainId,
    "--watch",
    "--via-ir",
  ];

  let ctorPath: string | undefined;
  if (opts.constructorArgsHex) {
    ctorPath = path.join(os.tmpdir(), `hookit-ctor-${opts.address.slice(2, 10)}.hex`);
    fs.writeFileSync(ctorPath, opts.constructorArgsHex);
    baseArgs.push("--constructor-args-path", ctorPath);
  }

  const run = async (extra: string[], env: NodeJS.ProcessEnv) => {
    const { stdout, stderr } = await execFileAsync("forge", [...baseArgs, ...extra], {
      cwd: REPO_ROOT,
      env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
    });
    return `${stdout}\n${stderr}`;
  };

  const asResult = (output: string) => ({
    ok: true,
    alreadyVerified: /already verified/i.test(output),
    output,
  });

  const asErrorOutput = (err: unknown) =>
    err && typeof err === "object" && "stdout" in err
      ? `${String((err as { stdout?: string }).stdout)}\n${String((err as { stderr?: string }).stderr)}`
      : err instanceof Error
        ? err.message
        : "forge verify-contract failed";

  try {
    if (apiKey) {
      try {
        const output = await run(
          ["--etherscan-api-key", apiKey],
          {
            ...process.env,
            BASESCAN_API_KEY: apiKey,
            ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY ?? apiKey,
          },
        );
        return asResult(output);
      } catch (err) {
        const output = asErrorOutput(err);
        if (/already verified/i.test(output)) return asResult(output);
      }
    }

    try {
      const output = await run(["--verifier", "sourcify"], { ...process.env });
      return asResult(output);
    } catch (err) {
      const output = asErrorOutput(err);
      if (/already verified/i.test(output)) return asResult(output);
      const hint = apiKey
        ? output
        : `${output}\nSet INK_EXPLORER_API_KEY (Ink) or BASESCAN_API_KEY (Base Sepolia) in the repo root .env — Sourcify fallback also failed.`;
      throw new Error(hint.slice(0, 2000));
    }
  } finally {
    if (ctorPath) {
      try {
        fs.unlinkSync(ctorPath);
      } catch {
        // ignore
      }
    }
  }
}
