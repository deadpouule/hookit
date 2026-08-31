"use client";

import { formatUnits, parseEther, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { useEffect, useMemo, useState } from "react";

import { getBondingFactoryAddress } from "@/lib/contracts/config";
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import {
  quoteBondingBuy,
  quoteBondingSell,
  type BondingQuoteResult,
} from "@/lib/bonding-quote";
import { bondingRowFromResult } from "@/lib/launches";
import type { TokenPool } from "@/lib/types";

export function useBondingQuote(opts: {
  pool: TokenPool;
  side: "buy" | "sell";
  amount: string;
  decimalsIn: number;
  decimalsOut: number;
  slippagePct: number;
  enabled: boolean;
}) {
  const bonding = getBondingFactoryAddress();
  const launchId = opts.pool.launchId;

  const { data: launchRaw } = useReadContract({
    address: bonding,
    abi: bondingFactoryAbi,
    functionName: "launches",
    args: launchId != null ? [BigInt(launchId)] : undefined,
    query: {
      enabled: opts.enabled && !!bonding && launchId != null,
      refetchInterval: 12_000,
    },
  });

  const launch = useMemo(() => bondingRowFromResult(launchRaw), [launchRaw]);

  const [quote, setQuote] = useState<BondingQuoteResult | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");

  useEffect(() => {
    if (!opts.enabled || !launch || !opts.amount || Number(opts.amount) <= 0) {
      setQuote(null);
      setReceiveAmount("");
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      try {
        const amountIn =
          opts.decimalsIn === 18
            ? parseEther(opts.amount)
            : parseUnits(opts.amount, opts.decimalsIn);

        const result =
          opts.side === "buy"
            ? quoteBondingBuy(launch, amountIn, opts.slippagePct)
            : quoteBondingSell(launch, amountIn, opts.slippagePct);

        if (cancelled) return;
        setQuote(result);
        setReceiveAmount(
          result && result.amountOut > 0n
            ? formatUnits(result.amountOut, opts.decimalsOut)
            : "",
        );
      } catch {
        if (!cancelled) {
          setQuote(null);
          setReceiveAmount("");
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    launch,
    opts.amount,
    opts.decimalsIn,
    opts.decimalsOut,
    opts.enabled,
    opts.side,
    opts.slippagePct,
  ]);

  return { receiveAmount, quote };
}
