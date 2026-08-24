export function TokenCardSkeleton() {
  return (
    <div className="panel overflow-hidden animate-pulse">
      <div className="card-banner bg-zinc-900" />
      <div className="space-y-3 px-4 pt-3 pb-4">
        <div className="h-4 w-2/3 rounded bg-white/5" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="h-3 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  );
}
