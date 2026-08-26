"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/layout/BrandMark";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { getNetworkLabel } from "@/lib/chains";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-ink/80 backdrop-blur-2xl">
      <div className="page-shell flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="flex h-8 w-8 items-center justify-center rounded-xl" />
          <span className="text-[15px] font-medium tracking-[-0.02em] text-white">
            hook<span className="text-degen">it</span>
          </span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
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
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
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
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/launch" className="btn-primary hidden !px-3.5 !py-1.5 text-xs sm:inline-flex">
            Create
          </Link>
          <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 lg:flex">
            <span className="h-1 w-1 rounded-full bg-ink-lavender shadow-[0_0_6px_#c084fc]" />
            {getNetworkLabel()}
          </span>
          <ConnectButton />
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.05] bg-ink/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-0.5">
            {NAV_LINKS.map((link) => {
              if ("external" in link && link.external) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-3 py-2.5 text-sm text-zinc-500"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm",
                    pathname === link.href ? "text-white" : "text-zinc-500",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/launch"
              onClick={() => setMobileOpen(false)}
              className="btn-primary mt-2 text-center text-sm"
            >
              Create token
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
