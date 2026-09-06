"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";

import { SwapTokenSelectModal } from "@/components/token/SwapTokenSelectModal";
import { InkAvatarBadge } from "@/components/home/market/InkAvatarBadge";
import { formatCompactUsd, formatTokenAmount } from "@/lib/format";
import { shortAddress } from "@/lib/master-hooks";
import type { PaymentAssetId } from "@/lib/payment-assets";
import { type SwapAsset, isStableSwapAsset, needsCompositeSell, poolQuoteSwapAsset } from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SwapQuoteDisplayMeta } from "@/lib/swap-quote";
import { resolveQuoteKind } from "@/lib/quote-usd";

const BALANCE_PRESETS = [15, 25, 50] as const;
/** ETH held back on MAX so the swap still has gas (L2 fees are far below this). */
const ETH_GAS_RESERVE = parseEther("0.0005");

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
    <span className="relative inline-flex h-8 w-8 shrink-0">
      <span className="h-8 w-8 overflow-hidden rounded-full bg-[#1a1a1c]">{inner}</span>
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
  sellBalanceRaw,
  tokenPriceEth,
  ethUsd = 3000,
  quoteUsd,
  quoteMeta,
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
  /** Exact on-chain balance — presets / MAX derive from this so the amount never exceeds it. */
  sellBalanceRaw?: bigint;
  tokenPriceEth?: number;
  /** Live ETH/USD — never hardcode $1000. */
  ethUsd?: number;
  /** USD price of one pool quote unit (ETH / USDG / stock). */
  quoteUsd?: number;
  quoteMeta?: SwapQuoteDisplayMeta | null;
}) {
  const [selectSide, setSelectSide] = useState<"sell" | "buy" | null>(null);
  const [flipAnim, setFlipAnim] = useState(false);

  const kind = resolveQuoteKind(pool.quoteAddress, pool.quoteAsset);
  const qUsd = quoteUsd ?? (kind === "eth" ? ethUsd : kind === "stable" ? 1 : undefined);
  const tokenPriceUsd = (tokenPriceEth ?? 0) * (qUsd ?? 0);
  const poolQuote = poolQuoteSwapAsset(pool);

  const assetUsd = (asset: SwapAsset, amount: number) => {
    if (!(amount > 0)) return 0;
    if (asset.isNative) return amount * ethUsd;
    if (isStableSwapAsset(asset)) return amount;
    if (
      poolQuote.address &&
      asset.address &&
      asset.address.toLowerCase() === poolQuote.address.toLowerCase()
    ) {
      return qUsd && qUsd > 0 ? amount * qUsd : 0;
    }
    return amount * tokenPriceUsd;
  };

  const sellUsd = assetUsd(sellAsset, Number(sellAmount));
  const receiveUsd = assetUsd(buyAsset, Number(receiveAmount));

  const handleInvert = () => {
    setFlipAnim(true);
    onInvert();
    window.setTimeout(() => setFlipAnim(false), 350);
  };

  const sellingLaunchToken =
    !sellAsset.isNative &&
    !!sellAsset.address &&
    !!pool.contractAddress &&
    sellAsset.address.toLowerCase() === pool.contractAddress.toLowerCase();
  const holderTracked = !!(pool.hooks.holderAirdrop || pool.modules?.holderAirdrop);

  const spendableRaw = (() => {
    if (sellBalanceRaw === undefined) return undefined;
    if (sellAsset.isNative) {
      // Keep a sliver of ETH for gas — sending the full balance as value fails on-chain.
      return sellBalanceRaw > ETH_GAS_RESERVE ? sellBalanceRaw - ETH_GAS_RESERVE : 0n;
    }
    // Launch tokens deployed against the pre-fix HolderAirdropVault panic when the last
    // tracked holder zeroes its balance; leaving 1 wei keeps MAX sells executable there.
    if (sellingLaunchToken && holderTracked && sellBalanceRaw > 1n) {
      return sellBalanceRaw - 1n;
    }
    return sellBalanceRaw;
  })();

  const applyPreset = (pct: number) => {
    if (spendableRaw !== undefined) {
      const part = (spendableRaw * BigInt(pct)) / 100n;
      if (part <= 0n) return;
      onSellAmount(formatUnits(part, sellAsset.decimals));
      return;
    }
    if (sellBalance <= 0) return;
    onSellAmount(String((sellBalance * pct) / 100));
  };

  const applyMax = () => {
    if (spendableRaw !== undefined) {
      if (spendableRaw <= 0n) return;
      onSellAmount(formatUnits(spendableRaw, sellAsset.decimals));
      return;
    }
    if (sellBalance <= 0) return;
    onSellAmount(sellBalance < 1 ? sellBalance.toFixed(6) : String(sellBalance));
  };

  const route = (() => {
    if (quoteMeta?.route) return quoteMeta.route;
    if (!receiveAmount || Number(sellAmount) <= 0) return "—";
    if (needsCompositeSell(pool, buyAsset)) {
      return `${sellAsset.symbol} → ${poolQuoteSwapAsset(pool).symbol} → ${buyAsset.symbol}`;
    }
    return `${sellAsset.symbol} → ${buyAsset.symbol}`;
  })();

  const minReceivedLabel = (() => {
    if (quoteMeta && quoteMeta.minAmountOut > 0n) {
      return `${formatTokenAmount(Number(formatUnits(quoteMeta.minAmountOut, buyAsset.decimals)))} ${buyAsset.symbol}`;
    }
    if (receiveAmount && Number(receiveAmount) > 0) {
      return `${formatTokenAmount(Number(receiveAmount) * (1 - slippagePct / 100))} ${buyAsset.symbol}`;
    }
    return "—";
  })();

  const priceImpactLabel =
    quoteMeta?.priceImpactPct != null ? `${quoteMeta.priceImpactPct.toFixed(2)}%` : "—";

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
            pattern="^[0-9]*[.,]?[0-9]*$"
            autoComplete="off"
            enterKeyHint="done"
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
          <button
            type="button"
            onClick={applyMax}
            disabled={spendableRaw !== undefined ? spendableRaw <= 0n : sellBalance <= 0}
            className="market-preset-btn market-preset-btn--max"
          >
            MAX
          </button>
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
          <span className="market-token-block__output">
            {receiveAmount && Number(receiveAmount) > 0
              ? formatTokenAmount(Number(receiveAmount))
              : receiveAmount || "—"}
          </span>
          <p className="market-token-block__usd">≈ {formatCompactUsd(receiveUsd)}</p>
        </div>
      </div>

      <dl className="market-details">
        <Detail label="Minimum received" value={minReceivedLabel} />
        <Detail label="Price impact" value={priceImpactLabel} />
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
