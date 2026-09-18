"use client";

import { formatUnits } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Link2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InkAvatarBadge } from "@/components/home/market/InkAvatarBadge";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useEthUsd } from "@/hooks/useEthUsd";
import { useLaunches } from "@/hooks/useLaunches";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { formatCompactUsd, formatTokenAmount } from "@/lib/format";
import { shortAddress } from "@/lib/master-hooks";
import {
  isStableSwapAsset,
  poolToSwapAsset,
  swapPickerQuoteAssets,
  type SwapAsset,
} from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

function resolveEthUsd(pool?: TokenPool, liveEthUsd?: number): number {
  if (liveEthUsd && liveEthUsd > 0) return liveEthUsd;
  if (pool?.quoteUsd && pool.quoteUsd > 100) return pool.quoteUsd;
  if (pool?.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * 1_000_000_000);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return 3000;
}

function EthMark() {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#627eea]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path
            fill="#fff"
            fillOpacity="0.92"
            d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
          />
        </svg>
      </span>
      <InkAvatarBadge />
    </span>
  );
}

function AssetIcon({ asset }: { asset: SwapAsset }) {
  if (asset.isNative) return <EthMark />;
  if (asset.imageUrl) {
    return (
      <span className="relative inline-flex h-9 w-9 shrink-0">
        <span className="h-9 w-9 overflow-hidden rounded-full bg-[#1a1a1c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
        </span>
        <InkAvatarBadge />
      </span>
    );
  }
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#eab308] text-[11px] font-bold text-black">
        {asset.symbol.slice(0, 1)}
      </span>
      <InkAvatarBadge />
    </span>
  );
}

export type WalletSwapRow = SwapAsset & {
  balance: number;
  valueUsd: number;
  pool?: TokenPool;
};

function TokenSelectBody({
  title,
  query,
  onQueryChange,
  onClose,
  loading,
  filtered,
  selectedKey,
  onSelect,
  stickySearch,
  listHeading = "Tokens",
}: {
  title: string;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  loading: boolean;
  filtered: WalletSwapRow[];
  selectedKey?: string;
  onSelect: (asset: SwapAsset) => void;
  stickySearch?: boolean;
  listHeading?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "flex flex-row items-center justify-between gap-3 border-b border-white/8 px-5 py-4",
          stickySearch && "sticky top-0 z-10 bg-black",
        )}
      >
        <p className="text-base font-semibold text-white">{title}</p>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className={cn(
          "border-b border-white/5 px-5 py-3",
          stickySearch && "sticky top-[3.75rem] z-10 bg-black",
        )}
      >
        <label className="swap-token-search">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search name, symbol, or address…"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-500 md:text-sm"
          />
        </label>
      </div>

      <div className="px-5 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{listHeading}</p>
      </div>

      <ul className="swap-token-list mt-2 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {loading && (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">Loading wallet…</li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">No tokens available</li>
        )}
        {!loading &&
          filtered.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(row);
                  onClose();
                }}
                className={cn(
                  "swap-token-row",
                  selectedKey === row.key && "swap-token-row--active",
                )}
              >
                <AssetIcon asset={row} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-white">{row.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-500">
                    <span>{row.symbol}</span>
                    {row.address && (
                      <>
                        <Link2 className="h-3 w-3 text-[#eab308]" />
                        <span className="font-mono">{shortAddress(row.address)}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatCompactUsd(row.valueUsd)}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {row.balance < 1 ? row.balance.toFixed(6) : formatTokenAmount(row.balance)}{" "}
                    {row.symbol}
                  </p>
                </div>
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}

export function SwapTokenSelectModal({
  open,
  onOpenChange,
  title,
  currentPool,
  side,
  selectedKey,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  currentPool: TokenPool;
  side: "sell" | "buy";
  selectedKey?: string;
  onSelect: (asset: SwapAsset) => void;
}) {
  const isMobile = useIsMobile();
  const liveEthUsd = useEthUsd();
  const [query, setQuery] = useState("");
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: pools } = useLaunches();
  const [walletRows, setWalletRows] = useState<WalletSwapRow[]>([]);
  const [loading, setLoading] = useState(false);

  const listedRows = useMemo<WalletSwapRow[]>(() => {
    const quotes = swapPickerQuoteAssets(currentPool).map((asset) => ({
      ...asset,
      balance: 0,
      valueUsd: 0,
    }));
    const token = poolToSwapAsset(currentPool);
    const page: WalletSwapRow = { ...token, balance: 0, valueUsd: 0, pool: currentPool };
    if (side === "buy") return [page, ...quotes];
    return [...quotes, page];
  }, [currentPool, side]);

  useEffect(() => {
    if (!open || !address || !publicClient) {
      setWalletRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const rows: WalletSwapRow[] = [];
      const poolByAddress = new Map<string, TokenPool>();

      for (const pool of pools ?? []) {
        if (pool.contractAddress) {
          poolByAddress.set(pool.contractAddress.toLowerCase(), pool);
        }
      }
      poolByAddress.set(
        (currentPool.contractAddress ?? "").toLowerCase(),
        currentPool,
      );

      const ethUsd = resolveEthUsd(currentPool, liveEthUsd);

      const pushBalance = async (asset: SwapAsset) => {
        if (rows.some((r) => r.key === asset.key)) return;
        let balance = 0;
        let valueUsd = 0;
        try {
          if (asset.isNative) {
            const ethBal = await publicClient.getBalance({ address });
            balance = Number(formatUnits(ethBal, 18));
            valueUsd = balance * ethUsd;
          } else if (asset.address) {
            const bal = (await publicClient.readContract({
              address: asset.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            })) as bigint;
            balance = Number(formatUnits(bal, asset.decimals));
            valueUsd = isStableSwapAsset(asset)
              ? balance
              : asset.isNative
                ? balance * ethUsd
                : balance * (currentPool.quoteUsd ?? 0);
          }
        } catch {
          /* keep zero */
        }
        rows.push({ ...asset, balance, valueUsd });
      };

      for (const asset of swapPickerQuoteAssets(currentPool)) {
        await pushBalance(asset);
      }
      await pushBalance(poolToSwapAsset(currentPool));

      const candidates = Array.from(poolByAddress.values())
        .filter((p) => p.contractAddress)
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
        .slice(0, 40);
      const balances = await Promise.all(
        candidates.map(async (pool) => {
          try {
            const bal = (await publicClient.readContract({
              address: pool.contractAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            })) as bigint;
            return { pool, amount: Number(formatUnits(bal, 18)) };
          } catch {
            return { pool, amount: 0 };
          }
        }),
      );

      for (const { pool, amount } of balances) {
        if (amount <= 0) continue;
        const asset = poolToSwapAsset(pool);
        if (rows.some((r) => r.key === asset.key)) continue;
        rows.push({
          ...asset,
          balance: amount,
          valueUsd: amount * (pool.priceEth ?? 0) * resolveEthUsd(pool, liveEthUsd),
          pool,
        });
      }

      if (!cancelled) {
        setWalletRows(rows);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, address, publicClient, pools, currentPool, liveEthUsd]);

  const filtered = useMemo(() => {
    const byKey = new Map(listedRows.map((row) => [row.key, row]));
    for (const row of walletRows) {
      const existing = byKey.get(row.key);
      if (existing) {
        byKey.set(row.key, { ...existing, ...row });
      } else if (row.balance > 0) {
        byKey.set(row.key, row);
      }
    }
    const extras = walletRows.filter(
      (row) => !listedRows.some((listed) => listed.key === row.key) && row.balance > 0,
    );
    const rows = [...listedRows.map((row) => byKey.get(row.key)!), ...extras];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.symbol.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.address?.toLowerCase().includes(q),
    );
  }, [listedRows, walletRows, query]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const body = (
    <TokenSelectBody
      title={title}
      query={query}
      onQueryChange={setQuery}
      onClose={() => handleOpenChange(false)}
      loading={Boolean(address && loading && filtered.length === 0)}
      filtered={filtered}
      selectedKey={selectedKey}
      onSelect={onSelect}
      stickySearch={isMobile}
      listHeading="Tokens"
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex h-[min(92dvh,720px)] flex-col gap-0 overflow-hidden rounded-t-2xl border border-white/10 bg-black p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/80"
        className="swap-token-modal max-h-[min(640px,90dvh)] overflow-hidden border border-white/10 bg-black p-0 sm:max-w-md"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
