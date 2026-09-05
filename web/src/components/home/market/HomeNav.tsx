"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HookitFunLogo } from "@/components/brand/HookitFunLogo";
import { LaunchRocketIcon } from "@/components/brand/LaunchRocketIcon";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/explore", label: "Hooks" },
  { href: "/stats", label: "Stats" },
] as const;

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProductPills() {
  const pathname = usePathname();

  return (
    <nav className="home-nav-pills" aria-label="Product">
      {PRODUCT_LINKS.map((link) => {
        const active = isNavActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("home-nav-pill", active && "home-nav-pill--active")}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HomeNav() {
  return (
    <header
      className="sticky top-0 z-50 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md"
      suppressHydrationWarning
    >
      <div className="market-shell home-nav-bar">
        <div className="home-nav-left">
          <Link href="/" aria-label="hookit.fun home" className="home-nav-brand">
            <HookitFunLogo />
          </Link>
          <ProductPills />
        </div>

        <div className="home-nav-right">
          <Link
            href="/launch"
            className="launch-coin-nav launch-coin-nav--full"
            aria-label="Launch coin"
          >
            <LaunchRocketIcon />
            Launch coin
          </Link>
          <ConnectButton compact className="home-connect--accent" />
        </div>
      </div>
    </header>
  );
}
