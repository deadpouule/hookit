export function TokenCardSkeleton() {
  return (
    <div className="explore-token-card animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="h-3 w-1/3 rounded bg-white/5" />
        </div>
        <div className="h-4 w-12 rounded bg-white/5" />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-2.5 w-14 rounded bg-white/5" />
            <div className="h-3.5 w-20 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-white/5" />
        ))}
      </div>
    </div>
  );
}
