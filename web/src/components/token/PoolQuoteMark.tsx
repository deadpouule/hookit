import { PairingMark } from "@/components/launch/PairingMark";
import { pairingBadgeFromQuoteAddress } from "@/lib/pairing-badge";
import { poolQuoteSwapAsset } from "@/lib/swap-assets";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";

/** Compact pairing / quote logo for multi-pool pills. */
export function PoolQuoteMark({
  quoteAddress,
  quoteAsset,
}: {
  quoteAddress?: string;
  quoteAsset?: string;
}) {
  const badge = pairingBadgeFromQuoteAddress(quoteAddress);
  if (badge) {
    return <PairingMark id={badge.pairingId} size="sm" />;
  }

  const asset = poolQuoteSwapAsset({
    quoteAddress,
    quoteAsset,
  } as TokenPool);

  if (asset.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.imageUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-full object-contain"
      />
    );
  }

  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[8px] font-bold text-zinc-200">
      {asset.symbol.slice(0, 1)}
    </span>
  );
}

export function PoolMarketMark({ market }: { market: TokenPoolMarket }) {
  return <PoolQuoteMark quoteAddress={market.quoteAddress} quoteAsset={market.quoteAsset} />;
}
