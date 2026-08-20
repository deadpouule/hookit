import { notFound } from "next/navigation";

import { TokenDetailView } from "@/components/token/TokenDetailView";
import { getAllPoolIds, getPoolById } from "@/lib/pools";

export function generateStaticParams() {
  return getAllPoolIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = getPoolById(id);
  if (!pool) return { title: "Token | hook it" };
  return {
    title: `${pool.name} ($${pool.ticker}) | hook it`,
    description: `Trade $${pool.ticker} on Uniswap v4 via hook it.`,
  };
}

export default async function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = getPoolById(id);
  if (!pool) notFound();

  return <TokenDetailView pool={pool} />;
}
