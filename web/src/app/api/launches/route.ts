import { loadLaunchesResponse } from "@/lib/server-launches";

export const revalidate = 12;

export async function GET() {
  try {
    const data = await loadLaunchesResponse();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=12, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load launches";
    return Response.json(
      { error: message, pools: [], factoryConfigured: true },
      { status: 502 },
    );
  }
}
