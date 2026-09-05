"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, ArrowUp, Menu } from "lucide-react";

import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MENU_LINKS = [
  { href: "/", label: "Tokens" },
  { href: "/explore", label: "Hooks" },
  { href: "/stats", label: "Analytics" },
  { href: "/docs", label: "Docs" },
  { href: "/launch", label: "Launch" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tokensActive = pathname === "/" || pathname.startsWith("/explore");

  return (
    <nav aria-label="Mobile" className="mobile-bottom-nav md:hidden">
      <div className="mobile-bottom-nav__inner">
        <Link
          href="/"
          className={cn("mobile-bottom-nav__item", tokensActive && "mobile-bottom-nav__item--active")}
        >
          <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
          <span>Tokens</span>
        </Link>

        <Link href="/launch" className="mobile-bottom-nav__launch" aria-label="Launch a token">
          <span className="mobile-bottom-nav__launch-btn">
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
          </span>
          <span>Launch</span>
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            type="button"
            className={cn("mobile-bottom-nav__item", open && "mobile-bottom-nav__item--active")}
            aria-label="Menu"
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
            <span>Menu</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl border-white/10 bg-[#0a0a0c] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-4">
              {MENU_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base text-zinc-200 hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2">
                <ConnectButton className="w-full justify-center" />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
