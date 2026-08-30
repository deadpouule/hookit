"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { PaymentAssetId } from "@/lib/payment-assets";
import { cn } from "@/lib/utils";

function EthMark() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#627eea]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#fff"
          fillOpacity="0.92"
          d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
        />
      </svg>
    </span>
  );
}

function TokenMark({ ticker, imageUrl }: { ticker: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#1a1a1c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9514d1] text-[10px] font-bold text-white">
      {ticker.slice(0, 2)}
    </span>
  );
}

const SLIPPAGE_PRESETS = [0.5, 1, 2] as const;

/** Market swap — you pay / you receive layout. */
export function TokenProSwap({
  ticker,
  tokenImageUrl,
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
  quoteLabel = "ETH",
}: {
  ticker: string;
  tokenImageUrl?: string;
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
  quoteLabel?: string;
}) {
  const sellTicker = ethOnTop
    ? payWith && payWith !== "ETH"
      ? payWith
      : quoteLabel
    : ticker;
  const buyTicker = ethOnTop ? ticker : quoteLabel;

  return (
    <div className="mt-4 space-y-2">
      <AssetBlock
        label="You pay"
        ticker={sellTicker}
        launchTicker={ticker}
        tokenImageUrl={tokenImageUrl}
        amount={sellAmount}
        onAmount={onSellAmount}
      />
      <div className="flex justify-center py-1">
        <button
          type="button"
          aria-label="Invert pair"
          onClick={onInvert}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1c] text-zinc-300 transition hover:border-[#9514d1] hover:bg-[#9514d1] hover:text-white"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      <AssetBlock
        label="You receive"
        ticker={buyTicker}
        launchTicker={ticker}
        tokenImageUrl={tokenImageUrl}
        amount={receiveAmount ?? ""}
        onAmount={() => undefined}
        readOnly
      />
      {showPayWith && ethOnTop && onPayWith && payWith && (
        <div className="swap-detail-row">
          <span className="swap-detail-row__label">Pay with</span>
          <select
            value={payWith}
            onChange={(e) => onPayWith(e.target.value as PaymentAssetId)}
            className="rounded-md border border-white/10 bg-[#1a1a1c] px-2 py-1 text-xs text-zinc-200 outline-none"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">{quoteLabel === "USDG" ? "USDG" : "USDC"}</option>
          </select>
        </div>
      )}
      <div className="swap-detail-row">
        <span className="swap-detail-row__label">Max slippage</span>
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
      <div className="swap-detail-row">
        <span className="swap-detail-row__label">Route</span>
        <span className="swap-detail-row__value font-mono text-[12px]">
          {sellTicker} → {buyTicker}
        </span>
      </div>
      <div className="swap-detail-row">
        <span className="swap-detail-row__label">Type</span>
        <span className="swap-detail-row__value">Market</span>
      </div>
    </div>
  );
}

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
  launchTicker,
  tokenImageUrl,
  amount,
  onAmount,
  readOnly,
}: {
  label: string;
  ticker: string;
  launchTicker: string;
  tokenImageUrl?: string;
  amount: string;
  onAmount: (value: string) => void;
  readOnly?: boolean;
}) {
  const isEth = ticker === "ETH";
  const isLaunchToken = ticker.toUpperCase() === launchTicker.toUpperCase();
  const launchImage = isLaunchToken ? tokenImageUrl : undefined;

  return (
    <div className={cn("rounded-lg bg-[#1a1a1c] p-3", readOnly && "opacity-90")}>
      <div className="text-[12px] text-zinc-500">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        {isEth ? <EthMark /> : <TokenMark ticker={ticker} imageUrl={launchImage} />}
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
