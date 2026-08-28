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
  getHookitSwapRouterAddress,
  getSwapRouterAddress,
  isProductionSwapRouter,
  supportsCompositeSwap,
  USDC_ADDRESS,
  V4_QUOTER_ADDRESS,
} from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import {
  hookitSwapRouterAbi,
  poolSwapTestAbi,
  v4QuoterAbi,
} from "@/lib/contracts/swap-abi";
import {
  isDirectBuy,
  paymentAssetById,
  poolQuoteAddress,
  type PaymentAssetId,
} from "@/lib/payment-assets";
import { poolKeyFromLaunch } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";
import {
  findBridgeRoute,
  hookRecipientData,
  hookSwapDirection,
  sqrtLimit,
} from "@/lib/v4-bridge";

export type SwapSide = "buy" | "sell";

export function useSwapToken(pool: TokenPool) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const quoteHookLeg = useCallback(
    async (side: SwapSide, quoteAmountIn: bigint): Promise<bigint | null> => {
      if (!publicClient || quoteAmountIn <= BigInt(0)) return null;
      const key = poolKeyFromLaunch(pool);
      const token = pool.contractAddress as Address | undefined;
      if (!key || !token) return null;

      const zeroForOne = hookSwapDirection(key, token, side);
      const hookData = hookRecipientData(address ?? zeroAddress);

      try {
        const { result } = await publicClient.simulateContract({
          address: V4_QUOTER_ADDRESS,
          abi: v4QuoterAbi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              poolKey: key,
              zeroForOne,
              exactAmount: quoteAmountIn,
              hookData,
            },
          ],
          account: address,
        });
        return result[0];
      } catch {
        return null;
      }
    },
    [address, pool, publicClient],
  );

  const quoteExactIn = useCallback(
    async (
      side: SwapSide,
      amountIn: bigint,
      paymentId: PaymentAssetId = "ETH",
    ): Promise<bigint | null> => {
      if (!publicClient || amountIn <= BigInt(0)) return null;

      if (side === "sell") {
        return quoteHookLeg("sell", amountIn);
      }

      const payment = paymentAssetById(paymentId);
      const poolQuote = poolQuoteAddress(pool);

      if (isDirectBuy(pool, payment)) {
        return quoteHookLeg("buy", amountIn);
      }

      const bridge = await findBridgeRoute(
        publicClient,
        payment.address,
        poolQuote,
        amountIn,
      );
      if (!bridge) return null;
      return quoteHookLeg("buy", bridge.amountOut);
    },
    [pool, publicClient, quoteHookLeg],
  );

  const swapExactIn = useCallback(
    async (
      side: SwapSide,
      amountHuman: string,
      slippagePct: number,
      paymentId: PaymentAssetId = "ETH",
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

        const quotedTokens = await quoteHookLeg("buy", bridge.amountOut);
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

      const quoted = await quoteExactIn(side, amountIn, paymentId);
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
        const allowance = (await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, router],
        })) as bigint;
        if (allowance < amountIn) {
          const approveHash = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [router, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
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
    [address, pool, publicClient, quoteExactIn, quoteHookLeg, writeContractAsync],
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
