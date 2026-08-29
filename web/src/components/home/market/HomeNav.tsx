"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CarabinerLogo } from "@/components/brand/CarabinerLogo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";

function RocketMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M12 3c2.8 2.2 4.2 5.4 4.2 9.2 0 1.4-.2 2.7-.6 3.8L12 21l-3.6-5c-.4-1.1-.6-2.4-.6-3.8C7.8 8.4 9.2 5.2 12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="1.4" fill="currentColor" />
    </svg>
  );
}

function MenuMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Explore" },
  { href: "/explore", label: "Hooks" },
  { href: "/stats", label: "Stats" },
  { href: "/docs", label: "Docs" },
] as const;

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = isNavActive(link.href, pathname);
        const className = cn("home-nav-link", active && "home-nav-link--active");

        if ("external" in link && link.external) {
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={className}
            >
              {link.label}
            </a>
          );
        }

        return (
          <Link key={link.label} href={link.href} onClick={onNavigate} className={className}>
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function HomeNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black" suppressHydrationWarning>
      <div className="market-shell flex h-16 items-center justify-between">
        <Link href="/" aria-label="hook it" className="flex shrink-0 items-center">
          <CarabinerLogo />
        </Link>

        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          <nav className="hidden items-center gap-0.5 lg:flex">
            <NavItems />
          </nav>
          <Link
            href="/launch"
            className="launch-coin hidden items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold sm:inline-flex"
          >
            <RocketMark />
            Launch coin
          </Link>
          <ConnectButton compact />
          <button
            type="button"
            {...TOOLBAR_BUTTON_PROPS}
            className="rounded-lg p-2 text-white hover:text-gray-300 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <CloseMark /> : <MenuMark />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] bg-black px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            <NavItems onNavigate={() => setOpen(false)} />
            <Link
              href="/launch"
              onClick={() => setOpen(false)}
              className="launch-coin mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold"
            >
              <RocketMark />
              Launch coin
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
