"use client";

import { TokenCard } from "@/components/explore/TokenCard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MasterHook } from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";

export function HookLiveUsesSheet({
  hook,
  pools,
  open,
  onOpenChange,
}: {
  hook: MasterHook;
  pools: TokenPool[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-hidden rounded-t-2xl border-white/10 bg-[#111111] p-0 sm:max-w-full"
      >
        <SheetHeader className="border-b border-white/[0.06] px-5 py-4 text-left">
          <SheetTitle className="text-base font-semibold text-white">
            Tokens using {hook.title}
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {pools.length} live {pools.length === 1 ? "use" : "uses"} on-chain
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto px-4 py-4">
          {pools.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pools.map((pool) => (
                <TokenCard
                  key={pool.id}
                  pool={pool}
                  marketplaceHookFilter={hook.id}
                  onMarketplaceNavigate={() => onOpenChange(false)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-black/30 px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">No tokens are using this hook yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Be the first to launch with {hook.title}.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
