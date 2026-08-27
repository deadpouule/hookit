import Link from "next/link";
import { CircleDot, Send } from "lucide-react";

export function StatusBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-black/90 backdrop-blur-md">
      <div className="market-shell flex h-9 items-center justify-between text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Not live
        </span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className="h-3 w-3 text-emerald-400" />
            Stable
          </span>
          <a href="/#tokens" className="hover:text-zinc-200">
            Pools
          </a>
          <Link href="/launch" className="hover:text-zinc-200">
            Launch
          </Link>
          <a
            href="https://github.com/deadpouule/hookit"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200"
            aria-label="GitHub"
          >
            <Send className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
