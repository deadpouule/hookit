import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INDEXER_URL = process.env.INDEXER_URL?.trim().replace(/\/$/, "") ?? "";

async function proxy(req: NextRequest, path: string[]) {
  if (!INDEXER_URL) {
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

  try {
    const upstream = await fetch(target.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
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
