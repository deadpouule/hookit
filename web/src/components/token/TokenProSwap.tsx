"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";

import { SwapTokenSelectModal } from "@/components/token/SwapTokenSelectModal";
import { InkAvatarBadge } from "@/components/home/market/InkAvatarBadge";
import { formatCompactUsd, formatTokenAmount } from "@/lib/format";
import { shortAddress } from "@/lib/master-hooks";
import type { PaymentAssetId } from "@/lib/payment-assets";
import { type SwapAsset, needsCompositeSell, poolQuoteSwapAsset, STABLE_SWAP_ASSET } from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const ETH_USD = 1000;
const BALANCE_PRESETS = [15, 25, 50] as const;

function EthMark() {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#627eea]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
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

function TokenMark({ asset }: { asset: SwapAsset }) {
  const inner = asset.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.imageUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-[#eab308] text-[10px] font-bold text-black">
      {asset.symbol.slice(0, 1)}
    </span>
  );

  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#1a1a1c]">
      {inner}
      <InkAvatarBadge />
    </span>
  );
}

function AssetIcon({ asset }: { asset: SwapAsset }) {
  return asset.isNative ? <EthMark /> : <TokenMark asset={asset} />;
}

function PickerLabel({ asset }: { asset: SwapAsset }) {
  if (asset.isNative) {
    return <span className="market-token-picker__symbol">{asset.symbol}</span>;
  }

  return (
    <span className="market-token-picker__text">
      <span className="market-token-picker__symbol">{asset.symbol}</span>
      {asset.address && (
        <span className="market-token-picker__ca">{shortAddress(asset.address)}</span>
      )}
    </span>
  );
}

/** Market swap — pools.fun Sell Token / Buy Token layout. */
export function TokenProSwap({
  pool,
  sellAsset,
  buyAsset,
  onSellAsset,
  onBuyAsset,
  sellAmount,
  onSellAmount,
  onInvert,
  receiveAmount,
  slippagePct,
  sellBalance,
  tokenPriceEth,
}: {
  pool: TokenPool;
  sellAsset: SwapAsset;
  buyAsset: SwapAsset;
  onSellAsset: (asset: SwapAsset) => void;
  onBuyAsset: (asset: SwapAsset) => void;
  sellAmount: string;
  onSellAmount: (value: string) => void;
  onInvert: () => void;
  receiveAmount?: string;
  slippagePct: number;
  sellBalance: number;
  tokenPriceEth?: number;
}) {
  const [selectSide, setSelectSide] = useState<"sell" | "buy" | null>(null);
  const [flipAnim, setFlipAnim] = useState(false);

  const sellUsd = (() => {
    const n = Number(sellAmount);
    if (!(n > 0)) return 0;
    if (sellAsset.isNative) return n * ETH_USD;
    return n * (tokenPriceEth ?? 0) * ETH_USD;
  })();

  const receiveUsd = (() => {
    const n = Number(receiveAmount);
    if (!(n > 0)) return 0;
    if (buyAsset.isNative) return n * ETH_USD;
    if (buyAsset.address?.toLowerCase() === STABLE_SWAP_ASSET.address?.toLowerCase()) return n;
    return n * (tokenPriceEth ?? 0) * ETH_USD;
  })();

  const handleInvert = () => {
    setFlipAnim(true);
    onInvert();
    window.setTimeout(() => setFlipAnim(false), 350);
  };

  const applyPreset = (pct: number) => {
    if (sellBalance <= 0) return;
    onSellAmount(String((sellBalance * pct) / 100));
  };

  const route = (() => {
    if (!receiveAmount || Number(sellAmount) <= 0) return "—";
    if (needsCompositeSell(pool, buyAsset)) {
      return `${sellAsset.symbol} → ${poolQuoteSwapAsset(pool).symbol} → ${buyAsset.symbol}`;
    }
    return `${sellAsset.symbol} → ${buyAsset.symbol}`;
  })();

  return (
    <div className="mt-3">
      <div className="market-token-block">
        <p className="market-token-block__heading">Sell Token</p>
        <button
          type="button"
          onClick={() => setSelectSide("sell")}
          className="market-token-picker market-token-picker--top"
        >
          <AssetIcon asset={sellAsset} />
          <PickerLabel asset={sellAsset} />
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-zinc-500" />
        </button>
        <div className="market-token-block__amount-stack">
          <input
            value={sellAmount}
            onChange={(e) => onSellAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            className="market-token-block__input"
          />
          <p className="market-token-block__usd">≈ {formatCompactUsd(sellUsd)}</p>
          <div className="market-token-block__balance-row">
            <span className="text-zinc-500">Balance</span>
            <span className="font-mono text-zinc-400">
              {sellBalance < 1 ? sellBalance.toFixed(6) : formatTokenAmount(sellBalance)}{" "}
              {sellAsset.symbol}
            </span>
          </div>
        </div>
        <div className="market-preset-row">
          {BALANCE_PRESETS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => applyPreset(pct)}
              className="market-preset-btn"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="market-flip-wrap">
        <button
          type="button"
          aria-label="Switch tokens"
          onClick={handleInvert}
          className={cn("market-flip-btn", flipAnim && "market-flip-btn--spin")}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <div className="market-token-block market-token-block--buy">
        <p className="market-token-block__heading">Buy Token</p>
        <button
          type="button"
          onClick={() => setSelectSide("buy")}
          className="market-token-picker market-token-picker--top"
        >
          <AssetIcon asset={buyAsset} />
          <PickerLabel asset={buyAsset} />
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-zinc-500" />
        </button>
        <div className="market-token-block__amount-stack">
          <span className="market-token-block__output">{receiveAmount || "—"}</span>
          <p className="market-token-block__usd">≈ {formatCompactUsd(receiveUsd)}</p>
        </div>
      </div>

      <dl className="market-details">
        <Detail
          label="Minimum received"
          value={
            receiveAmount
              ? `${formatTokenAmount(Number(receiveAmount))} ${buyAsset.symbol}`
              : "—"
          }
        />
        <Detail label="Price impact" value="—" />
        <Detail label="Route" value={route} />
        <Detail label="Max slippage" value={`${slippagePct}%`} />
        <Detail label="Platform fee" value="Free" valueClass="text-white" />
      </dl>

      <SwapTokenSelectModal
        open={selectSide === "sell"}
        onOpenChange={(open) => !open && setSelectSide(null)}
        title="Select sell token"
        currentPool={pool}
        side="sell"
        selectedKey={sellAsset.key}
        onSelect={onSellAsset}
      />
      <SwapTokenSelectModal
        open={selectSide === "buy"}
        onOpenChange={(open) => !open && setSelectSide(null)}
        title="Select buy token"
        currentPool={pool}
        side="buy"
        selectedKey={buyAsset.key}
        onSelect={onBuyAsset}
      />
    </div>
  );
}

export function useProQuoteAmount(opts: {
  amount: string;
  side: "buy" | "sell";
  payWith: PaymentAssetId;
  receiveAsset: SwapAsset;
  decimalsIn: number;
  decimalsOut: number;
  quoteExactIn: (
    side: "buy" | "sell",
    amountIn: bigint,
    paymentId: PaymentAssetId,
    receiveAsset?: SwapAsset,
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
          const quoted = await opts.quoteExactIn(
            opts.side,
            amountIn,
            opts.payWith,
            opts.receiveAsset,
          );
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
    opts.receiveAsset,
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

function Detail({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="market-details__row">
      <dt className="market-details__label">{label}</dt>
      <dd className={cn("market-details__value", valueClass)}>{value}</dd>
    </div>
  );
}
