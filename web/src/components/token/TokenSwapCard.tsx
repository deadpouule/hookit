"use client";

import { formatUnits, parseEther, parseUnits, zeroAddress } from "viem";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

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
import { formatTokenAmount } from "@/lib/format";
import { paymentAssetById, type PaymentAssetId } from "@/lib/payment-assets";
import {
  defaultSwapPair,
  isStableSwapAsset,
  NATIVE_ETH_ASSET,
  poolToSwapAsset,
  STABLE_SWAP_ASSET,
  type SwapAsset,
} from "@/lib/swap-assets";
import { toast } from "@/lib/toast";
import type { TokenPool } from "@/lib/types";
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
  if ((sell.isNative || isStableSwapAsset(sell)) && buy.key === tokenKey) return "buy";
  if (sell.key === tokenKey && (buy.isNative || isStableSwapAsset(buy))) return "sell";
  return sell.isNative || isStableSwapAsset(sell) ? "buy" : "sell";
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

export function TokenSwapCard({ pool }: { pool: TokenPool; ticker?: string }) {
  const ticker = pool.ticker;
  const poolAsset = useMemo(() => poolToSwapAsset(pool), [pool]);
  const searchParams = useSearchParams();
  const walletReady = useWalletReady();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: writing } = useWriteContract();
  const swap = useSwapToken(pool);
  const fetchTokenBalance = useTokenBalance(pool.contractAddress as `0x${string}` | undefined);
  const fetchEthBalance = useTokenBalance(undefined);
  const fetchUsdgBalance = useTokenBalance(STABLE_QUOTE_ADDRESS);

  const [side, setSide] = useState<Side>("buy");
  const [sellAsset, setSellAsset] = useState<SwapAsset>(NATIVE_ETH_ASSET);
  const [buyAsset, setBuyAsset] = useState<SwapAsset>(() => poolToSwapAsset(pool));
  const [amount, setAmount] = useState("");
  const [payWith, setPayWith] = useState<PaymentAssetId>("ETH");
  const [slippagePct] = useState(5);
  const [preset, setPreset] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenBal, setTokenBal] = useState<number>(0);
  const [ethBal, setEthBal] = useState<number>(0);
  const [usdgBal, setUsdgBal] = useState<number>(0);

  const liveEthUsd = useEthUsd();
  const ethUsd = resolveEthUsd(pool, liveEthUsd);

  const applySide = useCallback(
    (nextSide: Side) => {
      const pair = defaultSwapPair(pool, nextSide);
      setSide(nextSide);
      setSellAsset(pair.sell);
      setBuyAsset(pair.buy);
      setAmount("");
      setPreset(null);
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
    setPreset(null);
    // Reset pair when navigating to a different token page only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id, pool.contractAddress]);

  useEffect(() => {
    if (!walletReady) {
      setTokenBal(0);
      setEthBal(0);
      setUsdgBal(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [tokenRaw, ethRaw, usdgRaw] = await Promise.all([
          fetchTokenBalance(),
          fetchEthBalance(),
          fetchUsdgBalance(),
        ]);
        if (cancelled) return;
        setTokenBal(Number(formatUnits(tokenRaw, 18)));
        setEthBal(Number(formatUnits(ethRaw, 18)));
        setUsdgBal(Number(formatUnits(usdgRaw, 6)));
      } catch {
        if (!cancelled) {
          setTokenBal(0);
          setEthBal(0);
          setUsdgBal(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletReady, fetchTokenBalance, fetchEthBalance, fetchUsdgBalance, address]);

  const payAsset = payAssetForSide(side, sellAsset, buyAsset);
  const effectivePayWith = paymentIdFromAsset(payAsset);
  const onBonding = pool.rail === "classic" && pool.bondingPhase === 0;
  const bonding = getBondingFactoryAddress();
  const payDecimals =
    side === "buy" ? paymentAssetById(effectivePayWith).decimals : payAsset.decimals;
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

  const canTrade = useMemo(
    () => walletReady && !!pool.contractAddress && hasAmount,
    [walletReady, pool.contractAddress, hasAmount],
  );

  const marketSellBalance = sellAsset.isNative
    ? ethBal
    : isStableSwapAsset(sellAsset)
      ? usdgBal
      : tokenBal;

  const handleInvert = () => {
    const nextSell = buyAsset;
    const nextBuy = sellAsset;
    setSellAsset(nextSell);
    setBuyAsset(nextBuy);
    setSide(deriveSide(nextSell, nextBuy, pool));
    setAmount("");
    setPreset(null);
  };

  const handleSellAsset = (asset: SwapAsset) => {
    setSellAsset(asset);
    setPayWith(paymentIdFromAsset(asset));
    setSide(deriveSide(asset, buyAsset, pool));
    setAmount("");
    setPreset(null);
  };

  const handleBuyAsset = (asset: SwapAsset) => {
    setBuyAsset(asset);
    setPayWith(paymentIdFromAsset(asset));
    setSide(deriveSide(sellAsset, asset, pool));
    setAmount("");
    setPreset(null);
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
      const hash = await swap.swapExactIn(side, amount, slippagePct, effectivePayWith, buyAsset);
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
    : writing || swap.isPending
      ? "Confirm in wallet…"
      : side === "buy"
        ? `Buy ${ticker}`
        : `Sell ${ticker}`;

  return (
    <div className="desk-card p-4">
      <h2 className="swap-card-title">Swap</h2>

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
        onSellAmount={(v) => {
          setAmount(v);
          setPreset(null);
        }}
        onInvert={handleInvert}
        receiveAmount={quotedReceive}
        slippagePct={slippagePct}
        sellBalance={marketSellBalance}
        tokenPriceEth={pool.priceEth}
        ethUsd={ethUsd}
        quoteUsd={pool.quoteUsd}
        quoteMeta={swapQuoteMeta}
      />

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
            className={cn("swap-cta", hasAmount ? "swap-cta--ready" : "swap-cta--idle")}
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

function SwapDetailRow({
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
      <dt>{label}</dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}
