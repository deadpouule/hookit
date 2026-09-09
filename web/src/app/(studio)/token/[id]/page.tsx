import { Suspense } from "react";

import { TokenDetailPageClient } from "@/components/explore/TokenDetailPageClient";
import { getAllPoolIds, getDetailPool } from "@/lib/pools";
import { loadLaunchPoolById } from "@/lib/server-launches";
import { tokenShareMetadata } from "@/lib/token-share-metadata";

export const dynamicParams = true;
export const revalidate = 60;

export function generateStaticParams() {
  return getAllPoolIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return tokenShareMetadata(id, "token");
}

export default async function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let initialPool = getDetailPool(id);
  if (!initialPool) {
    try {
      initialPool = (await loadLaunchPoolById(id)) ?? undefined;
    } catch {
      /* client refetch */
    }
  }

  return (
    <Suspense
      fallback={
        <div className="market-shell py-20 text-center text-sm text-zinc-500">Loading token…</div>
      }
    >
      <TokenDetailPageClient id={id} initialPool={initialPool} />
    </Suspense>
  );
}
