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
  V4_QUOTER_ADDRESS,
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
import { poolKeyFromLaunch } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";
import {
  needsCompositeSell,
  type SwapAsset,
} from "@/lib/swap-assets";
import {
  findBridgeAmountOut,
  findBridgeRoute,
  hookRecipientData,
  hookSwapDirection,
  sqrtLimit,
} from "@/lib/v4-bridge";
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
      const hookKey = poolKeyFromLaunch(pool);
      const token = pool.contractAddress as Address | undefined;
      if (!hookKey || !token) throw new Error("Pool key unavailable for this launch");

      const payment = paymentAssetById(paymentId);
      const poolQuote = poolQuoteAddress(pool);
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

        const poolQuote = poolQuoteAddress(pool);
        const hookZeroForOne = hookSwapDirection(hookKey, token, "sell");
        const hookLimit = sqrtLimit(hookZeroForOne);

        const quotedQuote = await quoteHookLegLocal("sell", amountIn);
        if (!quotedQuote || quotedQuote <= BigInt(0)) {
          throw new Error("Could not quote pool leg for composite sell");
        }
        const minQuoteOut =
          (quotedQuote * BigInt(10_000 - bps)) / BigInt(10_000) || BigInt(1);

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

        const quoteBefore = (await publicClient.readContract({
          address: poolQuote,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;

        const hash1 = await writeContractAsync({
          address: hookitRouter,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactIn",
          args: [hookKey, hookZeroForOne, amountIn, minQuoteOut, hookLimit],
        });
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const quoteAfter = (await publicClient.readContract({
          address: poolQuote,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;
        const quoteReceived = quoteAfter - quoteBefore;
        if (quoteReceived <= BigInt(0)) {
          throw new Error("Pool leg did not credit quote for composite sell");
        }

        const bridgeLimit = sqrtLimit(bridge.zeroForOne);
        await ensureErc20Allowance(poolQuote, hookitRouter, quoteReceived);

        const hash2 = await writeContractAsync({
          address: hookitRouter,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactIn",
          args: [bridge.key, bridge.zeroForOne, quoteReceived, minStableOut, bridgeLimit],
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });
        return hash2;
      }

      if (side === "buy" && !isDirectBuy(pool, payment)) {
        if (!supportsCompositeSwap()) {
          throw new Error(
            "Pay-with needs HookitSwapRouter deployed. Set NEXT_PUBLIC_HOOKIT_SWAP_ROUTER in env.",
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
        const allowance = (await publicClient.readContract({
          address: quoteToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, router],
        })) as bigint;
        if (allowance < amountIn) {
          const approveHash = await writeContractAsync({
            address: quoteToken,
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
