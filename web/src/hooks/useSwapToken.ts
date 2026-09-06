"use client";

import { useCallback, useState } from "react";
import {
  parseUnits,
  type Address,
  zeroAddress,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import {
  STABLE_QUOTE_ADDRESS,
  getHookitSwapRouterAddress,
  getSwapRouterAddress,
  isProductionSwapRouter,
  supportsCompositeSwap,
  USDC_ADDRESS,
} from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { hookitSwapRouterAbi, poolSwapTestAbi } from "@/lib/contracts/swap-abi";
import {
  isDirectBuy,
  paymentAssetById,
  poolQuoteAddress,
  stableQuoteLabel,
  type PaymentAssetId,
} from "@/lib/payment-assets";
import { poolKeyForQuote, poolKeyFromLaunch } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";
import {
  needsCompositeSell,
  type SwapAsset,
} from "@/lib/swap-assets";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";
import {
  findBridgeRoute,
  hookRecipientData,
  hookSwapDirection,
  sqrtLimit,
} from "@/lib/v4-bridge";
import {
  quoteBestBuyPlan,
  quoteBestSellRoute,
  shouldAggregateMultiBuy,
  shouldAggregateMultiSell,
  type BestBuyLeg,
} from "@/lib/multi-pool-route";
import { quoteHookLeg, quotePoolSwapWithMeta } from "@/lib/swap-quote";

export type SwapSide = import("@/lib/swap-quote").SwapSide;

export function useSwapToken(pool: TokenPool) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const quoteHookLegLocal = useCallback(
    async (side: SwapSide, quoteAmountIn: bigint): Promise<bigint | null> => {
      if (!publicClient || quoteAmountIn <= BigInt(0)) return null;
      return quoteHookLeg(publicClient, pool, side, quoteAmountIn, address ?? zeroAddress);
    },
    [address, pool, publicClient],
  );

  const quoteExactIn = useCallback(
    async (
      side: SwapSide,
      amountIn: bigint,
      paymentId: PaymentAssetId = "ETH",
      receiveAsset?: SwapAsset,
    ): Promise<bigint | null> => {
      if (!publicClient || amountIn <= BigInt(0)) return null;
      const result = await quotePoolSwapWithMeta(
        publicClient,
        pool,
        side,
        amountIn,
        0,
        paymentId,
        receiveAsset,
        address ?? zeroAddress,
      );
      return result?.amountOut ?? null;
    },
    [address, pool, publicClient],
  );

  const ensureErc20Allowance = useCallback(
    async (token: Address, spender: Address, amount: bigint) => {
      if (!publicClient || !address) return;
      const allowance = (await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, spender],
      })) as bigint;
      if (allowance >= amount) return;
      const approveHash = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    },
    [address, publicClient, writeContractAsync],
  );

  const swapExactIn = useCallback(
    async (
      side: SwapSide,
      amountHuman: string,
      slippagePct: number,
      paymentId: PaymentAssetId = "ETH",
      receiveAsset?: SwapAsset,
    ) => {
      setError(null);
      if (!publicClient || !address) throw new Error("Connect wallet");
      const payment = paymentAssetById(paymentId);
      const token = pool.contractAddress as Address | undefined;
      if (!token) throw new Error("Pool key unavailable for this launch");

      const payDecimals = side === "buy" ? payment.decimals : 18;
      const amountIn = parseUnits(amountHuman, payDecimals);
      if (amountIn <= BigInt(0)) throw new Error("Enter an amount");

      let router: Address;
      try {
        router = getSwapRouterAddress();
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      const bps = Math.min(5_000, Math.max(1, Math.round(slippagePct * 100)));

      // Multi-pool sell aggregator: quote all Hookit legs (+ optional bridge) and execute best.
      if (side === "sell" && receiveAsset && shouldAggregateMultiSell(pool, receiveAsset)) {
        const best = await quoteBestSellRoute(
          publicClient,
          pool,
          amountIn,
          receiveAsset,
          address,
        );
        if (!best) {
          throw new Error("No viable sell route across multi-pool markets");
        }

        if (best.kind === "direct") {
          const zeroForOne = hookSwapDirection(best.hookKey, token, "sell");
          const minOut =
            (best.amountOut * BigInt(10_000 - bps)) / BigInt(10_000) || BigInt(1);
          await ensureErc20Allowance(token, router, amountIn);
          const hash = await writeContractAsync({
            address: router,
            abi: hookitSwapRouterAbi,
            functionName: "swapExactIn",
            args: [best.hookKey, zeroForOne, amountIn, minOut, sqrtLimit(zeroForOne)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
          return hash;
        }

        if (!supportsCompositeSwap() || !isProductionSwapRouter()) {
          throw new Error(
            "Best sell route needs HookitSwapRouter composite sell. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER.",
          );
        }
        const hookitRouter = getHookitSwapRouterAddress()!;
        const hookZeroForOne = hookSwapDirection(best.hookKey, token, "sell");
        const minOut =
          (best.amountOut * BigInt(10_000 - bps)) / BigInt(10_000) || BigInt(1);
        await ensureErc20Allowance(token, hookitRouter, amountIn);
        const hash = await writeContractAsync({
          address: hookitRouter,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactInCompositeSell",
          args: [
            best.bridge.key,
            best.bridge.zeroForOne,
            amountIn,
            best.hookKey,
            hookZeroForOne,
            best.marketQuote,
            minOut,
            sqrtLimit(best.bridge.zeroForOne),
            sqrtLimit(hookZeroForOne),
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }

      // Multi-pool buy aggregator (+ optional split across pools).
      if (side === "buy" && shouldAggregateMultiBuy(pool)) {
        const plan = await quoteBestBuyPlan(publicClient, pool, payment, amountIn, address);
        if (!plan) {
          throw new Error("No viable buy route across multi-pool markets");
        }

        const executeBuyLeg = async (leg: BestBuyLeg): Promise<`0x${string}`> => {
          const minOut =
            (leg.amountOut * BigInt(10_000 - bps)) / BigInt(10_000) || BigInt(1);
          const hookZeroForOne = hookSwapDirection(leg.hookKey, token, "buy");

          if (leg.kind === "direct") {
            if (payment.address !== zeroAddress) {
              await ensureErc20Allowance(payment.address, router, leg.amountIn);
            }
            const hash = await writeContractAsync({
              address: router,
              abi: hookitSwapRouterAbi,
              functionName: "swapExactIn",
              args: [
                leg.hookKey,
                hookZeroForOne,
                leg.amountIn,
                minOut,
                sqrtLimit(hookZeroForOne),
              ],
              value: payment.address === zeroAddress ? leg.amountIn : BigInt(0),
            });
            await publicClient.waitForTransactionReceipt({ hash });
            return hash;
          }

          if (!supportsCompositeSwap() || !isProductionSwapRouter()) {
            throw new Error(
              "Best buy route needs HookitSwapRouter. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER.",
            );
          }
          const hookitRouter = getHookitSwapRouterAddress()!;
          if (payment.address !== zeroAddress) {
            await ensureErc20Allowance(payment.address, hookitRouter, leg.amountIn);
          }
          const hash = await writeContractAsync({
            address: hookitRouter,
            abi: hookitSwapRouterAbi,
            functionName: "swapExactInComposite",
            args: [
              leg.bridge.key,
              leg.bridge.zeroForOne,
              leg.amountIn,
              leg.hookKey,
              hookZeroForOne,
              leg.marketQuote,
              minOut,
              sqrtLimit(leg.bridge.zeroForOne),
              sqrtLimit(hookZeroForOne),
            ],
            value: payment.address === zeroAddress ? leg.amountIn : BigInt(0),
          });
          await publicClient.waitForTransactionReceipt({ hash });
          return hash;
        };

        let lastHash: `0x${string}` | undefined;
        for (const leg of plan.legs) {
          lastHash = await executeBuyLeg(leg);
        }
        if (!lastHash) throw new Error("Buy aggregator produced no transactions");
        return lastHash;
      }

      // Prefer the market matching payment (buy) or receive asset (sell) on multi launches.
      const receiveQuote =
        side === "sell" && receiveAsset
          ? receiveAsset.isNative
            ? zeroAddress
            : receiveAsset.address
          : undefined;
      const hookKey =
        side === "buy" && isDirectBuy(pool, payment)
          ? (poolKeyForQuote(pool, payment.address) ?? poolKeyFromLaunch(pool))
          : side === "sell" &&
              receiveQuote !== undefined &&
              (receiveAsset?.isNative || !!receiveAsset?.address) &&
              !needsCompositeSell(pool, receiveAsset!)
            ? (poolKeyForQuote(pool, receiveQuote) ?? poolKeyFromLaunch(pool))
            : poolKeyFromLaunch(pool);
      if (!hookKey) throw new Error("Pool key unavailable for this launch");

      const poolQuote = poolQuoteAddress(pool);

      if (
        side === "sell" &&
        receiveAsset &&
        needsCompositeSell(pool, receiveAsset) &&
        isProductionSwapRouter()
      ) {
        if (!supportsCompositeSwap()) {
          throw new Error(
            "Composite sell needs HookitSwapRouter deployed. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER in env.",
          );
        }

        const hookZeroForOne = hookSwapDirection(hookKey, token, "sell");
        const hookLimit = sqrtLimit(hookZeroForOne);

        const quotedQuote = await quoteHookLeg(
          publicClient,
          pool,
          "sell",
          amountIn,
          address,
        );
        if (!quotedQuote || quotedQuote <= BigInt(0)) {
          throw new Error(
            `Could not quote ${pool.ticker} → ${pool.quoteAsset ?? "quote"} for composite sell. Try the ${stableQuoteLabel()} or ETH pool tab for a direct sell.`,
          );
        }

        const bridge = await findBridgeRoute(
          publicClient,
          poolQuote,
          STABLE_QUOTE_ADDRESS,
          quotedQuote,
        );
        if (!bridge) {
          throw new Error(
            `No v4 route from pool quote (${pool.quoteAsset ?? "quote"}) to ${stableQuoteLabel()}`,
          );
        }
        const minStableOut =
          (bridge.amountOut * BigInt(10_000 - bps)) / BigInt(10_000) || BigInt(1);

        const hookitRouter = getHookitSwapRouterAddress()!;
        await ensureErc20Allowance(token, hookitRouter, amountIn);

        const hash = await writeContractAsync({
          address: hookitRouter,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactInCompositeSell",
          args: [
            bridge.key,
            bridge.zeroForOne,
            amountIn,
            hookKey,
            hookZeroForOne,
            poolQuote,
            minStableOut,
            sqrtLimit(bridge.zeroForOne),
            hookLimit,
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }

      if (side === "buy" && !isDirectBuy(pool, payment)) {
        if (!supportsCompositeSwap()) {
          throw new Error(
            "Pay-with needs HookitSwapRouter deployed. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER in env.",
          );
        }
        // Stock-quoted pools: only USDG → wStock → meme (no ETH hop on Ink yet).
        if (
          payment.address === zeroAddress &&
          INK_QUOTRON_STOCKS.some(
            (s) => s.address.toLowerCase() === poolQuote.toLowerCase(),
          )
        ) {
          throw new Error(
            `Pay with ${stableQuoteLabel()} for stock-paired tokens (ETH → stock bridge is not available).`,
          );
        }
        const bridge = await findBridgeRoute(
          publicClient,
          payment.address,
          poolQuote,
          amountIn,
        );
        if (!bridge) {
          throw new Error(`No v4 route from ${payment.label} to pool quote (${pool.quoteAsset ?? "quote"})`);
        }

        const quotedTokens = await quoteHookLegLocal("buy", bridge.amountOut);
        const minOut =
          quotedTokens && quotedTokens > BigInt(0)
            ? (quotedTokens * BigInt(10_000 - bps)) / BigInt(10_000)
            : BigInt(1);

        const hookitRouter = getHookitSwapRouterAddress()!;
        if (payment.address !== zeroAddress) {
          const allowance = (await publicClient.readContract({
            address: payment.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, hookitRouter],
          })) as bigint;
          if (allowance < amountIn) {
            const approveHash = await writeContractAsync({
              address: payment.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [hookitRouter, amountIn],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }
        }

        const hookZeroForOne = hookSwapDirection(hookKey, token, "buy");
        const hash = await writeContractAsync({
          address: hookitRouter,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactInComposite",
          args: [
            bridge.key,
            bridge.zeroForOne,
            amountIn,
            hookKey,
            hookZeroForOne,
            poolQuote,
            minOut,
            sqrtLimit(bridge.zeroForOne),
            sqrtLimit(hookZeroForOne),
          ],
          value: payment.address === zeroAddress ? amountIn : BigInt(0),
        });
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }

      const zeroForOne = hookSwapDirection(hookKey, token, side);
      const limit = sqrtLimit(zeroForOne);
      const hookData = hookRecipientData(address);

      const quoted = await quoteExactIn(side, amountIn, paymentId, receiveAsset);
      const minOut =
        quoted && quoted > BigInt(0)
          ? (quoted * BigInt(10_000 - bps)) / BigInt(10_000)
          : BigInt(1);

      const quoteToken =
        pool.quoteAddress && pool.quoteAddress !== zeroAddress
          ? pool.quoteAddress
          : pool.quoteAsset === "USDC"
            ? USDC_ADDRESS
            : zeroAddress;

      if (side === "buy" && quoteToken !== zeroAddress) {
        // Direct buy with payment token (may be secondary market USDG, not primary quote).
        const spendToken =
          isDirectBuy(pool, payment) && payment.address !== zeroAddress
            ? payment.address
            : quoteToken;
        const allowance = (await publicClient.readContract({
          address: spendToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, router],
        })) as bigint;
        if (allowance < amountIn) {
          const approveHash = await writeContractAsync({
            address: spendToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [router, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      if (side === "sell") {
        if (!token) throw new Error("Token address missing");
        await ensureErc20Allowance(token, router, amountIn);
      }

      const value =
        side === "buy" && isDirectBuy(pool, payment) && payment.address === zeroAddress
          ? amountIn
          : BigInt(0);
      let hash: `0x${string}`;

      if (isProductionSwapRouter()) {
        hash = await writeContractAsync({
          address: router,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactIn",
          args: [hookKey, zeroForOne, amountIn, minOut, limit],
          value,
        });
      } else {
        hash = await writeContractAsync({
          address: router,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [
            hookKey,
            {
              zeroForOne,
              amountSpecified: -amountIn,
              sqrtPriceLimitX96: limit,
            },
            { takeClaims: false, settleUsingBurn: false },
            hookData,
          ],
          value,
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [address, pool, publicClient, quoteExactIn, quoteHookLegLocal, ensureErc20Allowance, writeContractAsync],
  );

  return {
    quoteExactIn,
    swapExactIn,
    isPending,
    error,
    setError,
  };
}

export function useTokenBalance(token?: Address) {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  return useCallback(async (): Promise<bigint> => {
    if (!publicClient || !address) return BigInt(0);
    if (!token || token === zeroAddress) {
      return publicClient.getBalance({ address });
    }
    return publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }) as Promise<bigint>;
  }, [address, publicClient, token]);
}
