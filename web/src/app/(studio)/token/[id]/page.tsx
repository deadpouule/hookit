import { Suspense } from "react";

import { TokenDetailPageClient } from "@/components/explore/TokenDetailPageClient";
import { getAllPoolIds, getDetailPool } from "@/lib/pools";

export const dynamicParams = true;

export function generateStaticParams() {
  return getAllPoolIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = getDetailPool(id);
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
  return (
    <Suspense
      fallback={
        <div className="market-shell py-20 text-center text-sm text-zinc-500">Loading token…</div>
      }
    >
      <TokenDetailPageClient params={params} />
    </Suspense>
  );
}
