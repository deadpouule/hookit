import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128_000;
const MAX_BATCH_SIZE = 25;
const UPSTREAM_TIMEOUT_MS = 10_000;

// Read-only methods needed by viem/wagmi. Transactions are submitted by the
// connected wallet, never relayed through Hookit's paid RPC credentials.
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
]);

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

function rpcUrls(): string[] {
  return [
    process.env.INK_RPC_URL,
    process.env.INK_RPC_URL_BACKUP,
    process.env.INK_RPC_URL_TERTIARY,
  ]
    .map((url) => url?.trim())
    .filter((url, index, all): url is string => !!url && all.indexOf(url) === index);
}

function validRpcRequest(value: unknown): value is RpcRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Partial<RpcRequest>;
  return (
    request.jsonrpc === "2.0" &&
    typeof request.method === "string" &&
    ALLOWED_METHODS.has(request.method) &&
    (request.id === undefined ||
      request.id === null ||
      typeof request.id === "string" ||
      typeof request.id === "number") &&
    (request.params === undefined ||
      Array.isArray(request.params) ||
      (typeof request.params === "object" && request.params !== null))
  );
}

function jsonError(status: number, message: string, code = -32600) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code, message } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function isSameOriginBrowserRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || parsed.protocol !== `${protocol}:`) return false;
  } catch {
    return false;
  }
  return !fetchSite || fetchSite === "same-origin";
}

export async function POST(request: NextRequest) {
  if (!isSameOriginBrowserRequest(request)) {
    return jsonError(403, "Forbidden origin", -32003);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError(415, "Content-Type must be application/json");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError(413, "RPC request too large");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return jsonError(413, "RPC request too large");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonError(400, "Invalid JSON", -32700);
  }

  const requests = Array.isArray(payload) ? payload : [payload];
  if (
    requests.length === 0 ||
    requests.length > MAX_BATCH_SIZE ||
    !requests.every(validRpcRequest)
  ) {
    return jsonError(400, "Unsupported RPC request");
  }

  const urls = rpcUrls();
  if (urls.length === 0) {
    return jsonError(503, "RPC unavailable", -32000);
  }

  for (const url of urls) {
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) {
        if (upstream.status === 429 || upstream.status >= 500) continue;
        return jsonError(502, "RPC upstream rejected request", -32002);
      }

      const responseBody = await upstream.text();
      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      // Try the next server-only provider.
    }
  }

  return jsonError(503, "All RPC providers unavailable", -32000);
}
