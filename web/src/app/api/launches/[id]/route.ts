import { loadLaunchPoolById } from "@/lib/server-launches";

export const revalidate = 12;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return Response.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const pool = await loadLaunchPoolById(id.trim());
    if (!pool) {
      return Response.json({ error: "pool not found", pool: null }, { status: 404 });
    }
    return Response.json(
      { pool },
      {
        headers: {
          "Cache-Control": "public, s-maxage=12, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load launch";
    return Response.json({ error: message, pool: null }, { status: 502 });
  }
}
