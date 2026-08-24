import Link from "next/link";

function ChromeHookLogo() {
  return (
    <div className="chrome-emblem flex h-6 w-6 items-center justify-center rounded-md">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
        <path
          d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
          fill="#1a1a1f"
        />
      </svg>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06] py-10">
      <div className="page-shell flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-300">
            <ChromeHookLogo />
            hook it
          </Link>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-zinc-600">
            Uniswap v4 launchpad on Base. Modular master hooks or bring your own Solidity.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-zinc-600 uppercase">Product</span>
            <Link href="/explore" className="text-zinc-400 transition hover:text-zinc-200">
              Explore
            </Link>
            <Link href="/launch" className="text-zinc-400 transition hover:text-zinc-200">
              Create
            </Link>
            <Link href="/floor" className="text-zinc-400 transition hover:text-zinc-200">
              Floor
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-zinc-600 uppercase">Resources</span>
            <a
              href="https://github.com/deadpouule/hookit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 transition hover:text-zinc-200"
            >
              GitHub
            </a>
            <a
              href="https://docs.uniswap.org/contracts/v4/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 transition hover:text-zinc-200"
            >
              Uniswap v4
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-zinc-600 uppercase">Network</span>
            <span className="text-zinc-500">Base Sepolia</span>
            <span className="text-[11px] text-zinc-600">Testnet only</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
