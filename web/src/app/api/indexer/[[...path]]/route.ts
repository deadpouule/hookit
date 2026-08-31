import { NextRequest, NextResponse } from "next/server";

const INDEXER_URL = process.env.INDEXER_URL?.trim().replace(/\/$/, "") ?? "";

const HEALTH_CACHE_SEC = 10;
const READ_CACHE_SEC = 8;

function cacheControlForPath(path: string[]): string {
  const isHealth = path.length === 0 || path[0] === "health";
  const sec = isHealth ? HEALTH_CACHE_SEC : READ_CACHE_SEC;
  return `public, s-maxage=${sec}, stale-while-revalidate=30`;
}

async function proxy(req: NextRequest, path: string[]) {
  if (!INDEXER_URL) {
    const isHealth = path.length === 0 || path[0] === "health";
    if (isHealth) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          chainId: 0,
          cursor: "",
          updatedAt: Date.now(),
          lastPollAt: null,
          lastPollError: null,
          latestBlock: null,
          lagBlocks: null,
          tokens: 0,
        },
        { headers: { "cache-control": cacheControlForPath(path) } },
      );
    }
    return NextResponse.json(
      {
        error: "indexer not configured",
        hint: "Set INDEXER_URL to a hosted indexer when ready (charts / trades / holders)",
      },
      { status: 503 },
    );
  }

  const suffix = path.length ? `/${path.join("/")}` : "/health";
  const target = new URL(`${INDEXER_URL}${suffix.startsWith("/") ? suffix : `/${suffix}`}`);
  target.search = req.nextUrl.search;

  const isHealth = path.length === 0 || path[0] === "health";
  const revalidate = isHealth ? HEALTH_CACHE_SEC : READ_CACHE_SEC;

  try {
    const upstream = await fetch(target.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": cacheControlForPath(path),
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "indexer unreachable",
        hint: INDEXER_URL
          ? "Check INDEXER_URL is reachable from this deployment"
          : "Set INDEXER_URL to a hosted indexer when ready (charts / trades / holders)",
        indexerUrl: INDEXER_URL || null,
      },
      { status: 503 },
    );
  }
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
