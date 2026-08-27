"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleDot,
  Flame,
  LayoutGrid,
  Search,
  Table2,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { formatPercent, formatUsd } from "@/lib/format";
import {
  MARKET_TOKENS,
  truncateCreator,
  type MarketToken,
} from "@/lib/market-tokens";
import { tokenHref } from "@/lib/routes";
import { SEARCH_FIELD_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

import { BondMeter, MarketTokenCard } from "./MarketTokenCard";
import { QuickBuy } from "./QuickBuy";
import { TokenArt } from "./TokenArt";

type SortKey = "top" | "trending" | "movers" | "live";
type LayoutMode = "grid" | "table";

function sortTokens(tokens: MarketToken[], sort: SortKey) {
  const next = [...tokens];
  if (sort === "top") return next.sort((a, b) => b.marketCap - a.marketCap);
  if (sort === "trending") return next.sort((a, b) => b.volume - a.volume);
  if (sort === "movers") return next.sort((a, b) => Math.abs(b.change1h) - Math.abs(a.change1h));
  return next.sort((a, b) => b.launchedAt - a.launchedAt);
}

export function Marketplace() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("top");
  const [layout, setLayout] = useState<LayoutMode>("grid");

  const tokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = MARKET_TOKENS.filter((token) => {
      const matchesQuery =
        !q ||
        token.name.toLowerCase().includes(q) ||
        token.ticker.toLowerCase().includes(q) ||
        token.description.toLowerCase().includes(q) ||
        token.creator.toLowerCase().includes(q);
      return matchesQuery;
    });
    return sortTokens(filtered, sort);
  }, [query, sort]);

  const trending = useMemo(
    () => [...MARKET_TOKENS].sort((a, b) => b.change1h - a.change1h).slice(0, 8),
    [],
  );

  return (
    <div className="space-y-5">
      <section id="party" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="terminal-title text-sm font-semibold text-white">Trending now</h2>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {trending.map((token) => (
            <article
              key={token.id}
              className="relative flex min-w-[240px] shrink-0 cursor-pointer items-center gap-3 rounded-2xl border border-transparent bg-[#141416] px-3 py-2.5 transition-all duration-300 hover:border-[#9514d1] hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
              onClick={() => router.push(tokenHref(token.id))}
            >
              <TokenArt
                token={token}
                className="pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                glyphClassName="text-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="pointer-events-none flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{token.name}</p>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      token.change1h >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {formatPercent(token.change1h, true)}
                  </span>
                </div>
                <QuickBuy size="sm" className="relative z-20 mt-1.5" />
              </div>
              <Link
                href={tokenHref(token.id)}
                className="absolute inset-0 z-10"
                aria-label={`${token.name} $${token.ticker}`}
              >
                <span className="sr-only">
                  {token.name} ${token.ticker}
                </span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="tokens" className="scroll-mt-24 space-y-4">
        <div
          className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
          suppressHydrationWarning
        >
          <div className="relative w-full max-w-xl" suppressHydrationWarning>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              {...SEARCH_FIELD_PROPS}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tokens"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#141416] pr-3 pl-10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-[#141416] p-1">
              <FilterPill active={sort === "top"} onClick={() => setSort("top")} icon={Trophy} label="Top" />
              <FilterPill active={sort === "trending"} onClick={() => setSort("trending")} icon={Flame} label="Trending" />
              <FilterPill active={sort === "movers"} onClick={() => setSort("movers")} icon={TrendingUp} label="Movers" />
              <FilterPill active={sort === "live"} onClick={() => setSort("live")} icon={CircleDot} label="Live feed" live />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#141416] p-1">
              <FilterPill active label="All" onClick={() => undefined} />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#141416] p-1">
              <IconToggle active={layout === "table"} onClick={() => setLayout("table")} label="Table">
                <Table2 className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={layout === "grid"} onClick={() => setLayout("grid")} label="Grid">
                <LayoutGrid className="h-4 w-4" />
              </IconToggle>
            </div>
          </div>
        </div>

        {layout === "grid" ? (
          <div className="token-grid">
            {tokens.map((token) => (
              <MarketTokenCard key={token.id} token={token} />
            ))}
          </div>
        ) : (
          <TokenTable tokens={tokens} />
        )}
      </section>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon: Icon,
  live,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: typeof Trophy;
  live?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active ? "bg-[#2a2a2e] text-white" : "text-zinc-400 hover:text-white",
      )}
    >
      {live ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : null}
      {label}
    </button>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
        active ? "bg-[#2a2a2e] text-white" : "text-zinc-400 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function TokenTable({ tokens }: { tokens: MarketToken[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#141416]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-[11px] tracking-wide text-zinc-500 uppercase">
          <tr className="border-b border-white/[0.08]">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium">Market Cap</th>
            <th className="px-4 py-3 font-medium">Volume</th>
            <th className="px-4 py-3 font-medium">1h</th>
            <th className="px-4 py-3 font-medium">Bond</th>
            <th className="px-4 py-3 font-medium">Creator</th>
            <th className="px-4 py-3 font-medium">Buy</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr
              key={token.id}
              className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3">
                <Link href={tokenHref(token.id)} className="flex items-center gap-3">
                  <TokenArt
                    token={token}
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    glyphClassName="text-base"
                  />
                  <div>
                    <p className="font-medium text-white">{token.name}</p>
                    <p className="font-mono text-[11px] text-zinc-500">${token.ticker}</p>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-100">{formatUsd(token.marketCap)}</td>
              <td className="px-4 py-3 text-zinc-300">{formatUsd(token.volume)}</td>
              <td className={cn("px-4 py-3 font-medium", token.change1h >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatPercent(token.change1h, true)}
              </td>
              <td className="px-4 py-3">
                <BondMeter token={token} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">{truncateCreator(token.creator)}</td>
              <td className="px-4 py-3">
                <QuickBuy size="sm" className="min-w-[220px]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
