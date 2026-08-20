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
    <footer className="mt-auto border-t border-white/[0.06] py-8">
      <div className="page-shell flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <Link href="/explore" className="flex items-center gap-2 text-sm text-zinc-400">
          <ChromeHookLogo />
          hook it
        </Link>
        <div className="flex flex-wrap gap-6 text-sm text-zinc-500">
          <Link href="/explore" className="transition hover:text-zinc-300">
            Product
          </Link>
          <Link href="/launch" className="transition hover:text-zinc-300">
            Create
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-zinc-300"
          >
            Docs
          </a>
          <span className="text-zinc-600">Risk notice</span>
        </div>
      </div>
    </footer>
  );
}
