"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { ArrowDown } from "lucide-react";
import { useEffect, useState } from "react";

import { usePriceAlertWatcher, useTokenAlerts, type PriceAlertKind } from "@/lib/price-alerts";
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
type ProTab = "market" | "limit" | "stop";

/** Market orders + client-side limit/stop price alerts. */
export function TokenProSwap({
  ticker,
  tokenImageUrl,
  tokenAddress,
  spotEth,
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
  onOrderTabChange,
}: {
  ticker: string;
  tokenImageUrl?: string;
  tokenAddress?: string;
  spotEth?: number;
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
  onOrderTabChange?: (tab: ProTab) => void;
}) {
  const [tab, setTab] = useState<ProTab>("market");
  const [target, setTarget] = useState("");
  const alerts = useTokenAlerts(tokenAddress);
  usePriceAlertWatcher(tokenAddress, spotEth);

  useEffect(() => {
    onOrderTabChange?.(tab);
  }, [tab, onOrderTabChange]);

  const sellTicker = ethOnTop
    ? payWith && payWith !== "ETH"
      ? payWith
      : quoteLabel
    : ticker;
  const buyTicker = ethOnTop ? ticker : quoteLabel;

  const placeAlert = (kind: PriceAlertKind) => {
    const n = Number(target);
    if (!(n > 0)) return;
    alerts.add(kind, n, ticker);
    setTarget("");
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-2">
        {(["market", "limit", "stop"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative pb-1.5 text-[12px] capitalize transition",
              tab === id ? "font-medium text-white" : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            {id}
            {tab === id && <span className="absolute inset-x-0 bottom-0 h-px bg-[#9514d1]" />}
          </button>
        ))}
      </div>

      {tab === "market" ? (
        <>
          <AssetBlock
            label="You pay"
            ticker={sellTicker}
            launchTicker={ticker}
            tokenImageUrl={tokenImageUrl}
            amount={sellAmount}
            onAmount={onSellAmount}
          />
          <div className="flex justify-center">
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
        </>
      ) : (
        <div className="space-y-3 rounded-lg bg-[#111111] p-3">
          <p className="text-[12px] text-zinc-500">
            Browser alert — toasts when spot crosses your{" "}
            {tab === "limit" ? "limit (at or above)" : "stop (at or below)"}. Not an on-chain order.
          </p>
          {spotEth != null && spotEth > 0 && (
            <p className="font-mono text-[11px] text-zinc-400">
              Spot {spotEth.toExponential(4)} ETH
            </p>
          )}
          <label className="block text-[11px] text-zinc-500">
            Target price (ETH / token)
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-lg text-white outline-none focus:border-[#9514d1]/60"
            />
          </label>
          <button
            type="button"
            onClick={() => placeAlert(tab)}
            disabled={!tokenAddress || !(Number(target) > 0)}
            className="launch-coin w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Set {tab} alert
          </button>
          {alerts.alerts.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {alerts.alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between text-[11px] text-zinc-400"
                >
                  <span className="font-mono">
                    {a.kind} @ {a.targetEth.toExponential(3)}
                  </span>
                  <button
                    type="button"
                    className="text-zinc-600 hover:text-zinc-300"
                    onClick={() => alerts.remove(a.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
    <div className={cn("rounded-lg bg-[#111111] p-3", readOnly && "opacity-80")}>
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isEth ? (
          <EthMark />
        ) : (
          <TokenMark ticker={ticker} imageUrl={launchImage} />
        )}
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
