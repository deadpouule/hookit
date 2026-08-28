"use client";

import Link from "next/link";
import { CircleDot, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchIndexerHealth, type IndexerHealth } from "@/lib/indexer-client";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const [health, setHealth] = useState<IndexerHealth | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const next = await fetchIndexerHealth();
        if (!cancelled) setHealth(next);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const live = checked && !!health?.ok;
  const standby = checked && health?.configured === false;
  const lag = health?.lagBlocks;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-black/90 backdrop-blur-md">
      <div className="market-shell flex h-9 items-center justify-between text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "bg-emerald-400" : checked ? "bg-red-500" : "bg-zinc-600",
            )}
          />
          {live
            ? lag != null && lag > 50
              ? `Indexer · ${lag} blocks behind`
              : "Indexer live"
            : standby
              ? "Indexer standby"
            : checked
              ? "Indexer offline"
              : "Checking…"}
        </span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className={cn("h-3 w-3", live ? "text-emerald-400" : "text-zinc-600")} />
            {live ? "Synced" : "Standby"}
          </span>
          <a href="/#tokens" className="hover:text-zinc-200">
            Pools
          </a>
          <Link href="/launch" className="hover:text-zinc-200">
            Launch
          </Link>
          <a
            href="https://github.com/deadpouule/hookit"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200"
            aria-label="GitHub"
          >
            <Send className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
