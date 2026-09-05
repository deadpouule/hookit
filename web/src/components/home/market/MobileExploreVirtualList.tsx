"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

import type { MarketToken } from "@/lib/market-tokens";

import { MobileTokenRow } from "./MobileTokenRow";

const ROW_ESTIMATE = 96;

/** Window-virtualized mobile explore list — keeps DOM light on long catalogs. */
export function MobileExploreVirtualList({ tokens }: { tokens: MarketToken[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, [tokens.length]);

  const virtualizer = useWindowVirtualizer({
    count: tokens.length,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    scrollMargin,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={listRef} className="relative w-full overflow-x-hidden">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {items.map((item) => {
          const token = tokens[item.index];
          if (!token) return null;
          return (
            <div
              key={token.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${item.start - scrollMargin}px)`,
              }}
            >
              <MobileTokenRow token={token} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
