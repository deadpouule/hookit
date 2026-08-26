export function TokenCardSkeleton() {
  return (
    <div className="market-card overflow-hidden animate-pulse">
      <div className="aspect-square bg-[#1c1c1f]" />
      <div className="space-y-3 px-3 pt-3 pb-4">
        <div className="h-4 w-2/3 rounded bg-white/5" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
      </div>
      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="h-3 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  );
}
