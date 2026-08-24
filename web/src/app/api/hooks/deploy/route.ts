import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { analyzeCustomHookSource } from "@/lib/custom-hook";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(process.cwd(), "..");

function parseHookAddress(stdout: string): string | null {
  const match = stdout.match(/HookitCustomHook\s+(0x[a-fA-F0-9]{40})/);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  let body: { source?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const source = body.source?.trim() ?? "";
  const analysis = analyzeCustomHookSource(source);
  if (!analysis.valid) {
    return Response.json({ error: analysis.errors[0] ?? "Invalid hook source" }, { status: 400 });
  }

  if (!process.env.PRIVATE_KEY) {
    return Response.json(
      {
        error:
          "Hook deployment is not configured on this server. Run the app locally with PRIVATE_KEY in the repo root .env.",
      },
      { status: 503 },
    );
  }

  const rpcUrl =
    process.env.BASE_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

  try {
    const { stdout, stderr } = await execFileAsync(
      "forge",
      [
        "script",
        "script/DeployCustomHook.s.sol:DeployCustomHookScript",
        "--rpc-url",
        rpcUrl,
        "--broadcast",
        "--slow",
        "--chain",
        "84532",
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env },
        maxBuffer: 4 * 1024 * 1024,
      },
    );

    const address = parseHookAddress(`${stdout}\n${stderr}`);
    if (!address) {
      return Response.json({ error: "Deploy succeeded but hook address was not found in logs" }, { status: 500 });
    }

    return Response.json({
      address,
      contractName: analysis.contractName,
      note: "Hook mined and deployed via CREATE2. Your source is stored in token metadata.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forge deploy failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
