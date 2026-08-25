"use client";

import { useCallback, useState } from "react";
import { encodeAbiParameters, parseUnits, type Address, zeroAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import {
  getSwapRouterAddress,
  isProductionSwapRouter,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  USDC_ADDRESS,
  V4_QUOTER_ADDRESS,
} from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import {
  hookitSwapRouterAbi,
  poolSwapTestAbi,
  v4QuoterAbi,
} from "@/lib/contracts/swap-abi";
import { poolKeyFromLaunch } from "@/lib/pool-key";
import type { TokenPool } from "@/lib/types";

export type SwapSide = "buy" | "sell";

export function useSwapToken(pool: TokenPool) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const quoteExactIn = useCallback(
    async (side: SwapSide, amountIn: bigint): Promise<bigint | null> => {
      if (!publicClient || amountIn <= BigInt(0)) return null;
      const key = poolKeyFromLaunch(pool);
      if (!key) return null;

      const zeroForOne = side === "buy" ? !pool.tokenIsCurrency0 : !!pool.tokenIsCurrency0;
      const hookData = encodeAbiParameters([{ type: "address" }], [address ?? zeroAddress]);

      try {
        const { result } = await publicClient.simulateContract({
          address: V4_QUOTER_ADDRESS,
          abi: v4QuoterAbi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              poolKey: key,
              zeroForOne,
              exactAmount: amountIn,
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

  const swapExactIn = useCallback(
    async (side: SwapSide, amountHuman: string, slippagePct: number) => {
      setError(null);
      if (!publicClient || !address) throw new Error("Connect wallet");
      const key = poolKeyFromLaunch(pool);
      if (!key) throw new Error("Pool key unavailable for this launch");

      const quoteDecimals = pool.quoteAsset === "USDC" ? 6 : 18;
      const amountIn =
        side === "buy" ? parseUnits(amountHuman, quoteDecimals) : parseUnits(amountHuman, 18);
      if (amountIn <= BigInt(0)) throw new Error("Enter an amount");

      const zeroForOne = side === "buy" ? !pool.tokenIsCurrency0 : !!pool.tokenIsCurrency0;
      const limit = zeroForOne ? MIN_SQRT_PRICE + BigInt(1) : MAX_SQRT_PRICE - BigInt(1);
      const hookData = encodeAbiParameters([{ type: "address" }], [address]);
      const router = getSwapRouterAddress();

      const quoted = await quoteExactIn(side, amountIn);
      const bps = Math.min(5_000, Math.max(1, Math.round(slippagePct * 100)));
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
        const token = pool.contractAddress as Address | undefined;
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

      const value = side === "buy" && quoteToken === zeroAddress ? amountIn : BigInt(0);
      let hash: `0x${string}`;

      if (isProductionSwapRouter()) {
        hash = await writeContractAsync({
          address: router,
          abi: hookitSwapRouterAbi,
          functionName: "swapExactIn",
          args: [key, zeroForOne, amountIn, minOut, limit],
          value,
        });
      } else {
        hash = await writeContractAsync({
          address: router,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [
            key,
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
    [address, pool, publicClient, quoteExactIn, writeContractAsync],
  );

  return { quoteExactIn, swapExactIn, isPending, error, setError };
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
