"use client";

import { formatUnits, parseEther, parseUnits, zeroAddress } from "viem";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { PairingMark } from "@/components/launch/PairingMark";
import { TokenProSwap } from "@/components/token/TokenProSwap";
import { ConnectButton, useWalletReady } from "@/components/wallet/ConnectButton";
import { useBondingQuote } from "@/hooks/useBondingQuote";
import { useEthUsd } from "@/hooks/useEthUsd";
import { usePoolSwapQuote } from "@/hooks/usePoolSwapQuote";
import { useSwapToken, useTokenBalance } from "@/hooks/useSwapToken";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { getBondingFactoryAddress } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { formatTokenAmount, isValidLaunchTimestamp } from "@/lib/format";
import { resolveTokenModules } from "@/lib/launch-module-summary";
import { pairingBadgeFromQuoteAddress } from "@/lib/pairing-badge";
import { marketLegLabel, marketSharePct } from "@/lib/pool-active-market";
import { isDirectBuy, paymentAssetById, type PaymentAssetId } from "@/lib/payment-assets";
import {
  defaultSwapPair,
  isDirectPoolReceive,
  isPoolQuoteAsset,
  isStableSwapAsset,
  isStockQuotedPool,
  needsCompositeSell,
  poolQuoteSwapAsset,
  poolToSwapAsset,
  STABLE_SWAP_ASSET,
  type SwapAsset,
} from "@/lib/swap-assets";
import { toast } from "@/lib/toast";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { TokenPool, TokenPoolMarket } from "@/lib/types";
import { cn } from "@/lib/utils";

type Side = "buy" | "sell";

function resolveEthUsd(pool: TokenPool, liveEthUsd?: number): number {
  if (liveEthUsd && liveEthUsd > 0) return liveEthUsd;
  if (pool.quoteUsd && pool.quoteUsd > 100 && (!pool.quoteAddress || pool.quoteAddress === zeroAddress)) {
    return pool.quoteUsd;
  }
  if (pool.priceEth && pool.priceEth > 0 && pool.marketCap > 0) {
    const implied = pool.marketCap / (pool.priceEth * 1_000_000_000);
    if (implied > 100 && implied < 1_000_000) return implied;
  }
  return 3000;
}

function deriveSide(sell: SwapAsset, buy: SwapAsset, pool: TokenPool): Side {
  const tokenKey = poolToSwapAsset(pool).key;
  if (buy.key === tokenKey) return "buy";
  if (sell.key === tokenKey) return "sell";
  if (sell.isNative || isStableSwapAsset(sell) || isPoolQuoteAsset(pool, sell)) return "buy";
  return "sell";
}

function PoolLegLogo({ market }: { market: TokenPoolMarket }) {
  const badge = pairingBadgeFromQuoteAddress(market.quoteAddress);
  if (badge) {
    return <PairingMark id={badge.pairingId} size="sm" />;
  }

  const asset = poolQuoteSwapAsset({
    quoteAddress: market.quoteAddress,
    quoteAsset: market.quoteAsset,
  } as TokenPool);

  if (asset.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.imageUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-full object-contain"
      />
    );
  }

  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[8px] font-bold text-zinc-200">
      {asset.symbol.slice(0, 1)}
    </span>
  );
}

function paymentIdFromAsset(asset: SwapAsset): PaymentAssetId {
  if (asset.isNative) return "ETH";
  if (isStableSwapAsset(asset)) return "USDC";
  return "ETH";
}

function payAssetForSide(side: Side, sell: SwapAsset, buy: SwapAsset): SwapAsset {
  return side === "buy" ? sell : buy;
}

function SwapSideTabs({ side, onSide }: { side: Side; onSide: (side: Side) => void }) {
  return (
    <div className="swap-side-tabs">
      {(["buy", "sell"] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSide(id)}
          className={cn("swap-side-tab capitalize", side === id && "swap-side-tab--active")}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

export function TokenSwapCard({
  pool,
  markets,
  marketIndex = 0,
  onMarketIndex,
  buyPrefill,
  onBuyPrefillConsumed,
}: {
  pool: TokenPool;
  ticker?: string;
  markets?: TokenPoolMarket[];
  marketIndex?: number;
  onMarketIndex?: (index: number) => void;
  buyPrefill?: string | null;
  onBuyPrefillConsumed?: () => void;
}) {
  const ticker = pool.ticker;
  const searchParams = useSearchParams();
  const walletReady = useWalletReady();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: writing } = useWriteContract();
  const swap = useSwapToken(pool);
  const poolQuote = useMemo(() => poolQuoteSwapAsset(pool), [pool]);
  const fetchTokenBalance = useTokenBalance(pool.contractAddress as `0x${string}` | undefined);
  const fetchEthBalance = useTokenBalance(undefined);
  const fetchUsdgBalance = useTokenBalance(STABLE_QUOTE_ADDRESS);
  const quoteErc20 = poolQuote.address && !isStableSwapAsset(poolQuote) ? poolQuote.address : undefined;
  const fetchQuoteBalance = useTokenBalance(quoteErc20);

  const [side, setSide] = useState<Side>("buy");
  const [sellAsset, setSellAsset] = useState<SwapAsset>(() => defaultSwapPair(pool, "buy").sell);
  const [buyAsset, setBuyAsset] = useState<SwapAsset>(() => defaultSwapPair(pool, "buy").buy);
  const [amount, setAmount] = useState("");
  const [slippagePct] = useState(5);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenBal, setTokenBal] = useState<number>(0);
  const [ethBal, setEthBal] = useState<number>(0);
  const [usdgBal, setUsdgBal] = useState<number>(0);
  const [quoteBal, setQuoteBal] = useState<number>(0);

  const liveEthUsd = useEthUsd();
  const ethUsd = resolveEthUsd(pool, liveEthUsd);
  const modules = useMemo(() => resolveTokenModules(pool), [pool]);

  const applySide = useCallback(
    (nextSide: Side) => {
      const pair = defaultSwapPair(pool, nextSide);
      setSide(nextSide);
      setSellAsset(pair.sell);
      setBuyAsset(pair.buy);
      setAmount("");
    },
    [pool],
  );

  useEffect(() => {
    const buy = searchParams.get("buy");
    const sideParam = searchParams.get("side");
    if (buy && Number(buy) > 0) {
      setAmount(buy);
      applySide("buy");
    } else if (sideParam === "buy" || sideParam === "sell") {
      applySide(sideParam);
    }
  }, [searchParams, applySide]);

  useEffect(() => {
    const pair = defaultSwapPair(pool, side);
    setSellAsset(pair.sell);
    setBuyAsset(pair.buy);
    setAmount("");
    // Reset pair when navigating to a different token / market leg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id, pool.contractAddress, pool.quoteAddress, pool.poolId]);

  useEffect(() => {
    if (!buyPrefill) return;
    applySide("buy");
    setAmount(buyPrefill);
    onBuyPrefillConsumed?.();
  }, [buyPrefill, applySide, onBuyPrefillConsumed]);

  useEffect(() => {
    if (!walletReady) {
      setTokenBal(0);
      setEthBal(0);
      setUsdgBal(0);
      setQuoteBal(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [tokenRaw, ethRaw, usdgRaw, quoteRaw] = await Promise.all([
          fetchTokenBalance(),
          fetchEthBalance(),
          fetchUsdgBalance(),
          quoteErc20 ? fetchQuoteBalance() : Promise.resolve(BigInt(0)),
        ]);
        if (cancelled) return;
        setTokenBal(Number(formatUnits(tokenRaw, 18)));
        setEthBal(Number(formatUnits(ethRaw, 18)));
        setUsdgBal(Number(formatUnits(usdgRaw, 6)));
        setQuoteBal(Number(formatUnits(quoteRaw, poolQuote.decimals)));
      } catch {
        if (!cancelled) {
          setTokenBal(0);
          setEthBal(0);
          setUsdgBal(0);
          setQuoteBal(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletReady, fetchTokenBalance, fetchEthBalance, fetchUsdgBalance, fetchQuoteBalance, quoteErc20, poolQuote.decimals, address]);

  const payAsset = payAssetForSide(side, sellAsset, buyAsset);
  const effectivePayWith = paymentIdFromAsset(payAsset);
  const onBonding = pool.rail === "classic" && pool.bondingPhase === 0;
  const bonding = getBondingFactoryAddress();
  const payDecimals = side === "buy" ? payAsset.decimals : 18;
  const quoteDecimals =
    !pool.quoteAddress || pool.quoteAddress === zeroAddress
      ? 18
      : pool.quoteAsset?.match(/^w.+x$/i)
        ? 18
        : 6;

  const receiveDecimals =
    side === "buy" ? buyAsset.decimals : payAsset.isNative ? 18 : payAsset.decimals;

  const poolSwapQuote = usePoolSwapQuote({
    pool,
    side,
    amount,
    payWith: effectivePayWith,
    receiveAsset: buyAsset,
    payAsset: side === "buy" ? sellAsset : undefined,
    decimalsIn: payDecimals,
    decimalsOut: receiveDecimals,
    slippagePct,
    enabled: !onBonding,
  });

  const bondingQuote = useBondingQuote({
    pool,
    side,
    amount,
    decimalsIn: payDecimals,
    decimalsOut: side === "buy" ? 18 : quoteDecimals,
    slippagePct,
    enabled: onBonding,
  });

  const quotedReceive = onBonding ? bondingQuote.receiveAmount : poolSwapQuote.receiveAmount;
  const swapQuoteMeta = onBonding ? bondingQuote.quote : poolSwapQuote.quote;

  const hasAmount = !!amount && Number(amount) > 0;

  const maxWalletWarn = useMemo(() => {
    if (side !== "buy" || !modules?.modules.maxWallet || !quotedReceive) return null;
    const bps = modules.modules.maxWalletBps ?? 0;
    if (bps <= 0) return null;
    const capTokens = (TOTAL_SUPPLY * bps) / 10_000;
    const nextBal = tokenBal + Number(quotedReceive);
    if (nextBal <= capTokens) return null;
    const room = Math.max(0, capTokens - tokenBal);
    return {
      capPct: bps / 100,
      room,
      hint: room > 0
        ? `Max wallet is ${bps / 100}% of supply (~${formatTokenAmount(room)} ${ticker} left for you).`
        : `You already hold the max wallet (${bps / 100}% of supply).`,
    };
  }, [side, modules, quotedReceive, tokenBal, ticker]);

  const maxTxWarn = useMemo(() => {
    if (!modules?.modules.maxTx) return null;
    const bps = modules.modules.maxTxBps ?? 0;
    if (bps <= 0) return null;
    return `Max ${(bps / 100).toFixed(1)}% of supply per swap is enforced on-chain.`;
  }, [modules]);

  const snipeWarn = useMemo(() => {
    if (side !== "buy" || !modules?.modules.antiSnipe) return null;
    const launched = pool.launchedAt;
    if (!launched || !isValidLaunchTimestamp(launched)) return null;
    const duration = modules.modules.antiSnipeDuration ?? 0;
    const initialTax = modules.modules.antiSnipeInitialTax ?? 0;
    if (duration <= 0 || initialTax <= 0) return null;
    const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - launched);
    if (elapsed >= duration) return null;
    const left = duration - elapsed;
    const remainingTax = Math.max(0, Math.round(initialTax * (1 - elapsed / duration)));
    return `Anti-snipe window: ~${remainingTax}% extra buy tax (${left}s left).`;
  }, [side, modules, pool.launchedAt]);

  const canTrade = useMemo(
    () => walletReady && !!pool.contractAddress && hasAmount && !maxWalletWarn,
    [walletReady, pool.contractAddress, hasAmount, maxWalletWarn],
  );

  const marketSellBalance = sellAsset.isNative
    ? ethBal
    : isStableSwapAsset(sellAsset)
      ? usdgBal
      : isPoolQuoteAsset(pool, sellAsset)
        ? quoteBal
        : tokenBal;

  const handleInvert = () => {
    let nextSell = buyAsset;
    let nextBuy = sellAsset;
    // Stock pools: never land on ETH as the payment leg after invert.
    if (isStockQuotedPool(pool) && nextSell.isNative) {
      nextSell = STABLE_SWAP_ASSET;
    }
    if (isStockQuotedPool(pool) && nextBuy.isNative) {
      nextBuy = STABLE_SWAP_ASSET;
    }
    setSellAsset(nextSell);
    setBuyAsset(nextBuy);
    setSide(deriveSide(nextSell, nextBuy, pool));
    setAmount("");
  };

  const handleSellAsset = (asset: SwapAsset) => {
    const next =
      isStockQuotedPool(pool) && asset.isNative && buyAsset.key === poolToSwapAsset(pool).key
        ? STABLE_SWAP_ASSET
        : asset;
    setSellAsset(next);
    setSide(deriveSide(next, buyAsset, pool));
    setAmount("");
  };

  const handleBuyAsset = (asset: SwapAsset) => {
    setBuyAsset(asset);
    setSide(deriveSide(sellAsset, asset, pool));
    setAmount("");
  };

  const submit = async () => {
    setError(null);
    setStatus(null);
    if (!canTrade || !publicClient || !address) return;
    const loadingId = toast.loading(side === "buy" ? "Buying…" : "Selling…");

    try {
      if (onBonding) {
        if (!bonding || pool.launchId == null) {
          throw new Error("Bonding factory / launch id missing");
        }
        const launchId = BigInt(pool.launchId);
        if (side === "buy") {
          const isEth = !pool.quoteAddress || pool.quoteAddress === zeroAddress;
          const quoteIn = isEth ? parseEther(amount) : parseUnits(amount, 6);
          if (!isEth) {
            await writeContractAsync({
              address: pool.quoteAddress!,
              abi: erc20Abi,
              functionName: "approve",
              args: [bonding, quoteIn],
            });
          }
          setStatus("Buying on bonding curve…");
          const hash = await writeContractAsync({
            address: bonding,
            abi: bondingFactoryAbi,
            functionName: "buy",
            args: [launchId, isEth ? BigInt(0) : quoteIn, BigInt(1)],
            value: isEth ? quoteIn : BigInt(0),
          });
          await publicClient.waitForTransactionReceipt({ hash });
          setStatus("Buy confirmed");
          toast.dismiss(loadingId);
          toast.success("Buy confirmed", hash.slice(0, 10) + "…");
        } else {
          const tokensIn = parseUnits(amount, 18);
          await writeContractAsync({
            address: pool.contractAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [bonding, tokensIn],
          });
          setStatus("Selling on bonding curve…");
          const hash = await writeContractAsync({
            address: bonding,
            abi: bondingFactoryAbi,
            functionName: "sell",
            args: [launchId, tokensIn, BigInt(1)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          setStatus("Sell confirmed");
          toast.dismiss(loadingId);
          toast.success("Sell confirmed", hash.slice(0, 10) + "…");
        }
        return;
      }

      setStatus(side === "buy" ? "Buying…" : "Selling…");
      const hash = await swap.swapExactIn(
        side,
        amount,
        slippagePct,
        effectivePayWith,
        buyAsset,
        side === "buy" ? sellAsset : undefined,
      );
      toast.dismiss(loadingId);
      if (hash) {
        setStatus("Trade confirmed");
        toast.success("Trade confirmed", hash.slice(0, 10) + "…");
      }
    } catch (err) {
      toast.dismiss(loadingId);
      const msg = err instanceof Error ? err.message : "Trade failed";
      setError(msg);
      setStatus(null);
      toast.error("Trade failed", msg.slice(0, 120));
    }
  };

  const ctaLabel = !hasAmount
    ? "Enter amount"
    : maxWalletWarn
      ? "Exceeds max wallet"
      : writing || swap.isPending
        ? "Confirm in wallet…"
        : side === "buy"
          ? `Buy ${ticker}`
          : `Sell ${ticker}`;

  const routeLabel = (() => {
    if (swapQuoteMeta?.route) return swapQuoteMeta.route;
    if (side === "buy") {
      if (isPoolQuoteAsset(pool, payAsset) || isDirectBuy(pool, paymentAssetById(effectivePayWith))) {
        return `${payAsset.symbol} → ${ticker}`;
      }
      return `${payAsset.symbol} → ${poolQuote.symbol} → ${ticker}`;
    }
    if (needsCompositeSell(pool, buyAsset) || !isDirectPoolReceive(pool, buyAsset)) {
      return `${ticker} → ${poolQuote.symbol} → ${buyAsset.symbol}`;
    }
    return `${ticker} → ${buyAsset.symbol}`;
  })();

  return (
    <div className="desk-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="swap-card-title">Swap</h2>
        <span className="font-mono text-[11px] text-zinc-500">{routeLabel}</span>
      </div>

      {markets && markets.length > 1 && onMarketIndex ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] text-zinc-500">Trade on pool</p>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Quote pools">
            {markets.map((m, i) => (
              <button
                key={`${m.quoteAddress}-${i}`}
                type="button"
                role="tab"
                aria-selected={marketIndex === i}
                onClick={() => onMarketIndex(i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition",
                  marketIndex === i
                    ? "border-[#9514d1] bg-[#9514d1]/15 text-foreground"
                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-foreground",
                )}
              >
                <PoolLegLogo market={m} />
                {marketLegLabel(m)}
                <span className="opacity-60">{marketSharePct(m)} liq</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onBonding && (
        <p className="mt-3 rounded-lg border border-[#9514d1]/30 bg-[#9514d1]/10 px-3 py-2 text-[12px] text-zinc-300">
          Classic bonding curve — trades until 4.2 ETH-equiv graduation.
        </p>
      )}

      <SwapSideTabs side={side} onSide={applySide} />

      <TokenProSwap
        pool={pool}
        sellAsset={sellAsset}
        buyAsset={buyAsset}
        onSellAsset={handleSellAsset}
        onBuyAsset={handleBuyAsset}
        sellAmount={amount}
        onSellAmount={setAmount}
        onInvert={handleInvert}
        receiveAmount={quotedReceive}
        slippagePct={slippagePct}
        sellBalance={marketSellBalance}
        tokenPriceEth={pool.priceEth}
        ethUsd={ethUsd}
        quoteUsd={pool.quoteUsd}
        quoteMeta={swapQuoteMeta}
      />

      {maxWalletWarn && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
          {maxWalletWarn.hint}
        </p>
      )}
      {snipeWarn && (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-100/90">
          {snipeWarn}
        </p>
      )}
      {!maxWalletWarn && maxTxWarn && (
        <p className="mt-2 text-[11px] text-zinc-500">{maxTxWarn}</p>
      )}

      {!walletReady ? (
        <div className="swap-cta-sticky">
          <ConnectButton label="Connect to trade" className="launch-coin swap-cta swap-cta--ready" />
        </div>
      ) : (
        <div className="swap-cta-sticky">
          <button
            type="button"
            disabled={!canTrade || writing || swap.isPending}
            onClick={() => void submit()}
            className={cn("swap-cta", hasAmount && !maxWalletWarn ? "swap-cta--ready" : "swap-cta--idle")}
          >
            {ctaLabel}
          </button>
        </div>
      )}

      {status && <p className="mt-2 text-center text-[12px] text-emerald-400">{status}</p>}
      {(error || swap.error) && (
        <p className="mt-2 text-center text-[12px] text-red-400">{error ?? swap.error}</p>
      )}
    </div>
  );
}
