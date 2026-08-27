"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Compass, Code2, Layers, Rocket, Shield, Wrench } from "lucide-react";

import { GITHUB_REPO_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RAIL = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/launch", label: "Launch", icon: Rocket },
  { href: "/builder", label: "Builder", icon: Wrench },
  { href: "/floor", label: "Floor", icon: Shield },
] as const;

export function AppRail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <motion.aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      animate={{ width: open ? 188 : 64 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="fixed top-1/2 left-3 z-40 hidden -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/75 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:flex"
    >
      <nav className="flex flex-col gap-1 px-2">
        {RAIL.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm transition",
                active
                  ? "bg-neon-lime/15 text-white shadow-[inset_0_0_0_1px_rgba(212,255,0,0.35)]"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity",
                  open ? "opacity-100" : "opacity-0",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-2 mt-2 flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
      >
        <Code2 className="h-4 w-4 shrink-0" />
        <span className={cn("whitespace-nowrap transition-opacity", open ? "opacity-100" : "opacity-0")}>
          GitHub
        </span>
      </a>
      <div className="mx-2 mt-2 flex h-10 items-center gap-3 rounded-xl px-2.5 text-zinc-600">
        <Layers className="h-4 w-4 shrink-0" />
        <span className={cn("whitespace-nowrap text-[11px] tracking-wide uppercase transition-opacity", open ? "opacity-100" : "opacity-0")}>
          hook it
        </span>
      </div>
    </motion.aside>
  );
}
