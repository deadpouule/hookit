"use client";

import { parseEther, parseUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TokenProSwap, useProQuoteAmount } from "@/components/token/TokenProSwap";
import { ConnectButton, useWalletReady } from "@/components/wallet/ConnectButton";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { getBondingFactoryAddress } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { useSwapToken } from "@/hooks/useSwapToken";
import { QUICK_BUY_AMOUNTS } from "@/lib/market-tokens";
import { paymentAssetById, type PaymentAssetId } from "@/lib/payment-assets";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "pro" | "instant";
type Side = "buy" | "sell";

export function TokenSwapCard({ pool }: { pool: TokenPool; ticker?: string }) {
  const ticker = pool.ticker;
  const searchParams = useSearchParams();
  const walletReady = useWalletReady();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: writing } = useWriteContract();
  const swap = useSwapToken(pool);

  const [mode, setMode] = useState<Mode>("instant");
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [payWith, setPayWith] = useState<PaymentAssetId>("ETH");
  const [slippagePct, setSlippagePct] = useState(1);
  const [preset, setPreset] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const buy = searchParams.get("buy");
    const sideParam = searchParams.get("side");
    if (buy && Number(buy) > 0) {
      setAmount(buy);
      setMode("instant");
    }
    if (sideParam === "buy" || sideParam === "sell") setSide(sideParam);
  }, [searchParams]);

  const onBonding = pool.rail === "classic" && pool.bondingPhase === 0;
  const bonding = getBondingFactoryAddress();
  const payDecimals = side === "buy" ? paymentAssetById(payWith).decimals : 18;

  const receiveAmount = useProQuoteAmount({
    amount,
    side,
    payWith,
    decimalsIn: payDecimals,
    decimalsOut: 18,
    quoteExactIn: swap.quoteExactIn,
    enabled: !onBonding && mode === "pro",
  });

  const canTrade = useMemo(
    () => walletReady && !!pool.contractAddress && !!amount && Number(amount) > 0,
    [walletReady, pool.contractAddress, amount],
  );

  const submit = async () => {
    setError(null);
    setStatus(null);
    if (!canTrade || !publicClient || !address) return;

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
        }
        return;
      }

      setStatus(side === "buy" ? "Buying…" : "Selling…");
      const hash = await swap.swapExactIn(side, amount, slippagePct, payWith);
      if (hash) setStatus("Trade confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
      setStatus(null);
    }
  };

  return (
    <div className="desk-card p-4">
      <div className="flex items-center gap-4 text-sm">
        {(["pro", "instant"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "relative pb-1 font-medium capitalize transition",
              mode === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {id}
            {mode === id && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#9514d1]" />}
          </button>
        ))}
      </div>

      {onBonding && (
        <p className="mt-3 rounded-lg border border-[#9514d1]/30 bg-[#9514d1]/10 px-3 py-2 text-[12px] text-zinc-300">
          Classic bonding curve — trades until 4.2 ETH-equiv graduation.
        </p>
      )}

      {mode === "pro" ? (
        <TokenProSwap
          ticker={ticker}
          quoteLabel={onBonding ? (pool.quoteAsset ?? "ETH") : "ETH"}
          sellAmount={amount}
          onSellAmount={(v) => {
            setAmount(v);
            setPreset(null);
          }}
          ethOnTop={side === "buy"}
          onInvert={() => setSide((s) => (s === "buy" ? "sell" : "buy"))}
          receiveAmount={receiveAmount}
          slippagePct={slippagePct}
          onSlippagePct={setSlippagePct}
          payWith={payWith}
          onPayWith={setPayWith}
          showPayWith={!onBonding}
        />
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4 text-sm">
            {(["buy", "sell"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSide(id)}
                className={cn(
                  "relative pb-1 font-medium capitalize transition",
                  side === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {id}
                {side === id && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#9514d1]" />}
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-[12px] text-zinc-500">Amount</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 focus-within:border-[#9514d1]/60">
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPreset(null);
                }}
                placeholder="0.0"
                className="min-w-0 flex-1 bg-transparent font-mono text-lg text-white outline-none placeholder:text-zinc-600"
              />
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200">
                {side === "buy" ? (onBonding ? pool.quoteAsset ?? "ETH" : payWith) : ticker}
                <ChevronDown className="h-3 w-3 text-zinc-500" />
              </span>
            </div>
          </label>

          {side === "buy" && (
            <>
              <div className="mt-3 flex gap-1.5">
                {QUICK_BUY_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAmount(String(value / 1000));
                      setPreset(value);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 font-mono text-[11px] font-semibold transition-all duration-300",
                      preset === value
                        ? "border-[#9514d1] bg-[#9514d1] text-white shadow-[0_0_15px_rgba(149,20,209,0.5)]"
                        : "border-transparent bg-[#2a2a2e] text-zinc-300 hover:border-[#9514d1] hover:text-white",
                    )}
                  >
                    [${value}]
                  </button>
                ))}
              </div>
              {!onBonding && (
                <label className="mt-3 flex items-center justify-between text-[12px] text-zinc-500">
                  Pay with
                  <select
                    value={payWith}
                    onChange={(e) => setPayWith(e.target.value as PaymentAssetId)}
                    className="rounded-md border border-white/10 bg-[#1a1a1c] px-2 py-1 text-xs text-zinc-200 outline-none"
                  >
                    <option value="ETH">ETH</option>
                    <option value="USDC">{pool.quoteAsset === "USDG" ? "USDG" : "USDC"}</option>
                  </select>
                </label>
              )}
            </>
          )}
        </>
      )}

      {!walletReady ? (
        <ConnectButton
          label="Connect to trade"
          className="launch-coin mt-4 flex w-full justify-center rounded-xl py-3 text-sm font-semibold"
        />
      ) : (
        <button
          type="button"
          disabled={!canTrade || writing || swap.isPending}
          onClick={() => void submit()}
          className="launch-coin mt-4 flex w-full justify-center rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {writing || swap.isPending
            ? "Confirm in wallet…"
            : side === "buy"
              ? `Buy ${ticker}`
              : `Sell ${ticker}`}
        </button>
      )}

      {status && <p className="mt-2 text-center text-[12px] text-emerald-400">{status}</p>}
      {(error || swap.error) && (
        <p className="mt-2 text-center text-[12px] text-red-400">{error ?? swap.error}</p>
      )}
    </div>
  );
}
