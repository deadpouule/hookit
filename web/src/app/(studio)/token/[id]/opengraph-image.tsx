import { TOKEN_OG_SIZE } from "@/lib/site-metadata";
import { TOKEN_OG_TYPE, tokenOpenGraphImage } from "@/lib/token-og-image";

export const alt = "Token";
export const size = TOKEN_OG_SIZE;
export const contentType = TOKEN_OG_TYPE;
export const runtime = "nodejs";
export const revalidate = 60;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return tokenOpenGraphImage(id);
}
