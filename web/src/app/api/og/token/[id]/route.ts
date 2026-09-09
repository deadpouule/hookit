import { tokenOpenGraphImage } from "@/lib/token-og-image";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return tokenOpenGraphImage(id);
}
