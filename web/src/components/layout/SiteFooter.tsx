import Link from "next/link";

import { BrandMark } from "@/components/layout/BrandMark";
import { getNetworkLabel, getNetworkSubtitle } from "@/lib/chains";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.05] py-10">
      <div className="page-shell flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400">
            <BrandMark className="flex h-6 w-6 items-center justify-center rounded-lg" />
            hookit
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-600">
            {getNetworkSubtitle()}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-700">Product</span>
            <Link href="/explore" className="text-zinc-500 transition hover:text-zinc-300">
              Pools
            </Link>
            <Link href="/launch" className="text-zinc-500 transition hover:text-zinc-300">
              Create
            </Link>
            <Link href="/builder" className="text-zinc-500 transition hover:text-zinc-300">
              Builder
            </Link>
            <Link href="/floor" className="text-zinc-500 transition hover:text-zinc-300">
              Floor
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-700">Links</span>
            <a
              href="https://github.com/deadpouule/hookit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 transition hover:text-zinc-300"
            >
              GitHub
            </a>
            <a
              href="https://docs.uniswap.org/contracts/v4/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 transition hover:text-zinc-300"
            >
              Uniswap v4
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-700">Network</span>
            <span className="text-zinc-600">{getNetworkLabel()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
