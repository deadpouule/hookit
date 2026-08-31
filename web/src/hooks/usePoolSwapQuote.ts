"use client";

import { formatUnits, parseEther, parseUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";

import { quotePoolSwapWithMeta, type PoolSwapQuoteMeta } from "@/lib/swap-quote";
import type { PaymentAssetId } from "@/lib/payment-assets";
import type { SwapAsset } from "@/lib/swap-assets";
import type { TokenPool } from "@/lib/types";
import type { SwapSide } from "@/lib/swap-quote";

export function usePoolSwapQuote(opts: {
  pool: TokenPool;
  side: SwapSide;
  amount: string;
  payWith: PaymentAssetId;
  receiveAsset: SwapAsset;
  decimalsIn: number;
  decimalsOut: number;
  slippagePct: number;
  enabled: boolean;
}) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [receiveAmount, setReceiveAmount] = useState("");
  const [quote, setQuote] = useState<PoolSwapQuoteMeta | null>(null);

  useEffect(() => {
    if (!opts.enabled || !publicClient || !opts.amount || Number(opts.amount) <= 0) {
      setReceiveAmount("");
      setQuote(null);
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

          const result = await quotePoolSwapWithMeta(
            publicClient,
            opts.pool,
            opts.side,
            amountIn,
            opts.slippagePct,
            opts.payWith,
            opts.receiveAsset,
            address ?? zeroAddress,
          );

          if (cancelled) return;
          if (!result) {
            setReceiveAmount("");
            setQuote(null);
            return;
          }

          setQuote(result);
          setReceiveAmount(formatUnits(result.amountOut, opts.decimalsOut));
        } catch {
          if (!cancelled) {
            setReceiveAmount("");
            setQuote(null);
          }
        }
      })();
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    address,
    publicClient,
    opts.pool,
    opts.amount,
    opts.side,
    opts.payWith,
    opts.receiveAsset,
    opts.decimalsIn,
    opts.decimalsOut,
    opts.slippagePct,
    opts.enabled,
  ]);

  return { receiveAmount, quote };
}
