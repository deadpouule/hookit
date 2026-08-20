"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2 } from "lucide-react";

import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function ChromeHookLogo() {
  return (
    <div className="chrome-emblem flex h-8 w-8 items-center justify-center rounded-lg">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path
          d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
          fill="#1a1a1f"
          stroke="#3f3f46"
          strokeWidth="0.75"
        />
        <path d="M12 11v6M9.5 17h5" stroke="#52525b" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <div className="page-shell flex h-14 items-center justify-between">
        <Link href="/explore" className="flex items-center gap-2.5">
          <ChromeHookLogo />
          <span className="text-[15px] font-medium tracking-tight text-zinc-100">
            hook <span className="text-zinc-400">it</span>
          </span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = !("external" in link) && pathname === link.href;
            const isExternal = "external" in link && link.external;

            if (isExternal) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-200"
                >
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 sm:block"
            aria-label="GitHub"
          >
            <Code2 className="h-4 w-4" />
          </a>
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-lime" />
            Base Sepolia
          </span>
          <button
            type="button"
            className="rounded-full border border-white/15 bg-transparent px-4 py-1.5 text-sm text-zinc-100 transition hover:bg-white/5"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}
