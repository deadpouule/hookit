import { TokenDetailPageClient } from "@/components/explore/TokenDetailPageClient";
import { getAllPoolIds, getPoolById } from "@/lib/pools";

export const dynamicParams = true;

export function generateStaticParams() {
  return getAllPoolIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = getPoolById(id);
  if (!pool) {
    return {
      title: "Token | hook it",
      description: "Trade on Uniswap v4 via hook it.",
    };
  }
  return {
    title: `${pool.name} ($${pool.ticker}) | hook it`,
    description: `Trade $${pool.ticker} on Uniswap v4 via hook it.`,
  };
}

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <TokenDetailPageClient params={params} />;
}
