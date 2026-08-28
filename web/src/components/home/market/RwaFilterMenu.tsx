"use client";

import { CategorySplitFilter } from "@/components/home/market/CategorySplitFilter";
import { RwaGlyph } from "@/components/home/market/CategoryGlyphs";
import { INK_QUOTRON_STOCKS, quotronStockLogoUrl } from "@/lib/xstocks";

type RwaFilterMenuProps = {
  active: boolean;
  selectedQuote: string | null;
  onSelectedQuoteChange: (quote: string | null) => void;
  onActivateRwa: () => void;
};

export function RwaFilterMenu({
  active,
  selectedQuote,
  onSelectedQuoteChange,
  onActivateRwa,
}: RwaFilterMenuProps) {
  const selectedStock = selectedQuote
    ? INK_QUOTRON_STOCKS.find((stock) => stock.symbol.toLowerCase() === selectedQuote.toLowerCase())
    : null;

  const label = selectedStock ? selectedStock.symbol : "RWA pools";

  const items = INK_QUOTRON_STOCKS.map((stock) => ({
    id: stock.symbol,
    title: stock.symbol,
    subtitle: stock.name.toUpperCase(),
    imageUrl: quotronStockLogoUrl(stock),
  }));

  return (
    <CategorySplitFilter
      active={active}
      label={label}
      allLabel="All RWA pools"
      searchPlaceholder="Search RWA pools"
      glyph={<RwaGlyph />}
      items={items}
      selectedIds={selectedQuote ? [selectedQuote] : []}
      onActivate={onActivateRwa}
      onSelectedIdsChange={(ids) => onSelectedQuoteChange(ids[0] ?? null)}
    />
  );
}
