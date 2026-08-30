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
import { useLaunches } from "@/hooks/useLaunches";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { formatCompactUsd, formatTokenAmount } from "@/lib/format";
import { shortAddress } from "@/lib/master-hooks";
import {
  NATIVE_ETH_ASSET,
  poolToSwapAsset,
  type SwapAsset,
} from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const ETH_USD = 1000;

function EthMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#627eea]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path
          fill="#fff"
          fillOpacity="0.92"
          d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
        />
      </svg>
    </span>
  );
}

function AssetIcon({ asset }: { asset: SwapAsset }) {
  if (asset.isNative) return <EthMark />;
  if (asset.imageUrl) {
    return (
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#1a1a1c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eab308] text-[11px] font-bold text-black">
      {asset.symbol.slice(0, 1)}
    </span>
  );
}

export type WalletSwapRow = SwapAsset & {
  balance: number;
  valueUsd: number;
};

export function SwapTokenSelectModal({
  open,
  onOpenChange,
  title,
  currentPool,
  selectedKey,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  currentPool: TokenPool;
  selectedKey?: string;
  onSelect: (asset: SwapAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: pools } = useLaunches();

  const rows = useMemo(() => {
    const list: WalletSwapRow[] = [];
    list.push({ ...NATIVE_ETH_ASSET, balance: 0, valueUsd: 0 });

    const seen = new Set<string>([NATIVE_ETH_ASSET.key]);
    const addPool = (pool: TokenPool, balance = 0) => {
      const asset = poolToSwapAsset(pool);
      if (seen.has(asset.key)) return;
      seen.add(asset.key);
      const valueUsd = balance * (pool.priceEth ?? 0) * ETH_USD;
      list.push({ ...asset, balance, valueUsd });
    };

    addPool(currentPool);

    for (const pool of pools ?? []) {
      addPool(pool);
    }

    return list;
  }, [currentPool, pools]);

  // Hydrate balances when modal opens
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open || !address || !publicClient) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, number> = {};
      try {
        const ethBal = await publicClient.getBalance({ address });
        next[NATIVE_ETH_ASSET.key] = Number(formatUnits(ethBal, 18));
      } catch {
        next[NATIVE_ETH_ASSET.key] = 0;
      }

      for (const row of rows) {
        if (row.isNative || !row.address) continue;
        try {
          const bal = (await publicClient.readContract({
            address: row.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          })) as bigint;
          next[row.key] = Number(formatUnits(bal, row.decimals));
        } catch {
          next[row.key] = 0;
        }
      }
      if (!cancelled) setBalances(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, address, publicClient, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((row) => {
        const balance = balances[row.key] ?? row.balance;
        const poolForRow =
          row.key === poolToSwapAsset(currentPool).key
            ? currentPool
            : (pools?.find((p) => p.contractAddress === row.address) ?? null);
        const priceEth = row.isNative ? 1 : (poolForRow?.priceEth ?? 0);
        const valueUsd = row.isNative ? balance * ETH_USD : balance * priceEth * ETH_USD;
        return { ...row, balance, valueUsd };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.symbol.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q) ||
          row.address?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [rows, balances, query, currentPool, pools]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="swap-token-modal max-h-[min(640px,90vh)] overflow-hidden border border-white/10 bg-[#141416] p-0 sm:max-w-md"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="px-5 pt-4">
          <label className="swap-token-search">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, symbol, or address…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="mt-4 px-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Your tokens</p>
        </div>

        <ul className="swap-token-list mt-2 overflow-y-auto px-3 pb-4">
          {filtered.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(row);
                  onOpenChange(false);
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
                    {row.balance < 1 ? row.balance.toFixed(6) : formatTokenAmount(row.balance)} {row.symbol}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <p className="border-t border-white/8 px-5 py-3 text-[10px] uppercase tracking-wide text-zinc-600">
          Available on Hookit
        </p>
      </DialogContent>
    </Dialog>
  );
}
