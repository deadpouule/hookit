"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { PaymentAssetId } from "@/lib/payment-assets";

function EthMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#627eea] text-[11px] font-bold text-white">
      Ξ
    </span>
  );
}

function TokenMark({ ticker }: { ticker: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9514d1] text-[10px] font-bold text-white">
      {ticker.slice(0, 2)}
    </span>
  );
}

const SLIPPAGE_PRESETS = [0.5, 1, 2] as const;

/** Market-order panel wired to the parent TokenSwapCard submit. */
export function TokenProSwap({
  ticker,
  quoteLabel = "ETH",
  sellAmount,
  onSellAmount,
  ethOnTop,
  onInvert,
  receiveAmount,
  slippagePct,
  onSlippagePct,
  payWith,
  onPayWith,
  showPayWith,
}: {
  ticker: string;
  quoteLabel?: string;
  sellAmount: string;
  onSellAmount: (value: string) => void;
  ethOnTop: boolean;
  onInvert: () => void;
  receiveAmount?: string;
  slippagePct: number;
  onSlippagePct: (value: number) => void;
  payWith?: PaymentAssetId;
  onPayWith?: (id: PaymentAssetId) => void;
  showPayWith?: boolean;
}) {
  const sellTicker = ethOnTop
    ? payWith && payWith !== "ETH"
      ? payWith
      : quoteLabel
    : ticker;
  const buyTicker = ethOnTop ? ticker : quoteLabel;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-2">
        <span className="relative pb-1.5 text-[12px] font-medium text-white">
          Market
          <span className="absolute inset-x-0 bottom-0 h-px bg-[#9514d1]" />
        </span>
        <span className="pb-1.5 text-[12px] text-zinc-600" title="Coming soon">
          Limit
        </span>
        <span className="pb-1.5 text-[12px] text-zinc-600" title="Coming soon">
          Stop
        </span>
      </div>

      <AssetBlock
        label="You pay"
        ticker={sellTicker}
        amount={sellAmount}
        onAmount={onSellAmount}
      />

      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Invert pair"
          onClick={onInvert}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1c] text-zinc-300 transition hover:border-[#9514d1] hover:bg-[#9514d1] hover:text-white hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <AssetBlock
        label="You receive"
        ticker={buyTicker}
        amount={receiveAmount ?? ""}
        onAmount={() => undefined}
        readOnly
      />

      {showPayWith && ethOnTop && onPayWith && payWith && (
        <label className="flex items-center justify-between text-[12px] text-zinc-500">
          Pay with
          <select
            value={payWith}
            onChange={(e) => onPayWith(e.target.value as PaymentAssetId)}
            className="rounded-md border border-white/10 bg-[#1a1a1c] px-2 py-1 text-xs text-zinc-200 outline-none"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">{quoteLabel === "USDG" ? "USDG" : "USDC"}</option>
          </select>
        </label>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-[12px]">
        <span className="text-zinc-500">Max slippage</span>
        <div className="flex items-center gap-1">
          {SLIPPAGE_PRESETS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onSlippagePct(pct)}
              className={cn(
                "rounded-md px-2 py-0.5 font-mono text-[11px] transition",
                slippagePct === pct
                  ? "bg-[#9514d1] text-white"
                  : "bg-white/5 text-zinc-400 hover:text-white",
              )}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <dl className="space-y-1.5 pt-1 text-[12px]">
        <Detail label="Route" value={`${sellTicker} → ${buyTicker}`} />
        <Detail label="Type" value="Market" />
      </dl>
    </div>
  );
}

/** Debounced v4 quote helper used by TokenSwapCard. */
export function useProQuoteAmount(opts: {
  amount: string;
  side: "buy" | "sell";
  payWith: PaymentAssetId;
  decimalsIn: number;
  decimalsOut: number;
  quoteExactIn: (
    side: "buy" | "sell",
    amountIn: bigint,
    paymentId: PaymentAssetId,
  ) => Promise<bigint | null>;
  enabled: boolean;
}) {
  const [out, setOut] = useState<string>("");

  useEffect(() => {
    if (!opts.enabled || !opts.amount || Number(opts.amount) <= 0) {
      setOut("");
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const amountIn =
            opts.decimalsIn === 18
              ? parseEther(opts.amount)
              : parseUnits(opts.amount, opts.decimalsIn);
          const quoted = await opts.quoteExactIn(opts.side, amountIn, opts.payWith);
          if (cancelled) return;
          setOut(quoted && quoted > BigInt(0) ? formatUnits(quoted, opts.decimalsOut) : "");
        } catch {
          if (!cancelled) setOut("");
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    opts.amount,
    opts.side,
    opts.payWith,
    opts.decimalsIn,
    opts.decimalsOut,
    opts.quoteExactIn,
    opts.enabled,
  ]);

  return out;
}

function AssetBlock({
  label,
  ticker,
  amount,
  onAmount,
  readOnly,
}: {
  label: string;
  ticker: string;
  amount: string;
  onAmount: (value: string) => void;
  readOnly?: boolean;
}) {
  const isQuote = ticker === "ETH" || ticker === "USDG" || ticker === "USDC";
  return (
    <div className={cn("rounded-lg bg-[#111111] p-3", readOnly && "opacity-80")}>
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isQuote && ticker === "ETH" ? <EthMark /> : <TokenMark ticker={ticker} />}
        <span className="text-sm font-medium text-white">{ticker}</span>
        <input
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={readOnly ? "—" : "0.0"}
          inputMode="decimal"
          readOnly={readOnly}
          className="min-w-0 flex-1 bg-transparent text-right font-mono text-2xl text-white outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-300">{value}</dd>
    </div>
  );
}
