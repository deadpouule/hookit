"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Compass, ArrowLeftRight, Wallet } from "lucide-react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";

import { getLastSwapHref, LAUNCH_HREF } from "@/lib/routes";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "explore", label: "Explore", href: "/", icon: Compass, match: (p: string) => p === "/" || p.startsWith("/explore") },
  { id: "swap", label: "Swap", href: "swap", icon: ArrowLeftRight, match: (p: string) => p.startsWith("/token") },
  { id: "wallet", label: "Wallet", href: "wallet", icon: Wallet, match: () => false },
] as const;

function subscribeNoop() {
  return () => {};
}

export function MobileBottomNav() {
  const pathname = usePathname();
  // Re-read after route changes (pathname forces re-render on navigation).
  const swapHref = pathname ? getLastSwapHref() : LAUNCH_HREF;

  return (
    <nav aria-label="Mobile" className="mobile-bottom-nav md:hidden">
      <div className="mobile-bottom-nav__inner">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.id === "wallet") {
            return <WalletTab key={item.id} />;
          }
          const href = item.id === "swap" ? swapHref || LAUNCH_HREF : item.href;
          const active = item.match(pathname);
          return (
            <Link
              key={item.id}
              href={href}
              className={cn("mobile-bottom-nav__item", active && "mobile-bottom-nav__item--active")}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function WalletTab() {
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return (
      <button type="button" className="mobile-bottom-nav__item" disabled>
        <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        <span>Wallet</span>
      </button>
    );
  }

  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted: rkMounted }) => {
        const connected = rkMounted && account && chain;
        return (
          <button
            type="button"
            className={cn("mobile-bottom-nav__item", connected && "mobile-bottom-nav__item--active")}
            onClick={() => (connected ? openAccountModal?.() : openConnectModal?.())}
          >
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            <span>{connected ? "Wallet" : "Connect"}</span>
          </button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
