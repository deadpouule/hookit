"use client";

import { useCallback, useState } from "react";
import {
  decodeEventLog,
  isAddress,
  type Address,
  zeroAddress,
} from "viem";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import { packLaunchBitmask } from "@/lib/bitmask";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import {
  DEFAULT_STARTING_TICK,
  DEFAULT_TICK_SPACING,
  DEFAULT_TOTAL_SUPPLY,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { buildMetadataUri } from "@/lib/launch-metadata";
import type { LaunchFormState } from "@/lib/types";

export type LaunchResult = {
  launchId: bigint;
  token: Address;
  poolId: `0x${string}`;
  txHash: `0x${string}`;
};

export function useLaunchToken() {
  const factory = getLaunchFactoryAddress();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const { data: onChainLaunchFee } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "launchFee",
    query: { enabled: !!factory },
  });

  const launch = useCallback(
    async (form: LaunchFormState) => {
      setError(null);
      setResult(null);

      if (!factory) {
        throw new Error(
          "LaunchFactory not configured. Set NEXT_PUBLIC_LAUNCH_FACTORY in web/.env.local after deploying.",
        );
      }
      if (!publicClient) {
        throw new Error("Wallet RPC not ready");
      }
      if (form.quoteAsset !== "ETH") {
        throw new Error("Only native ETH quote is supported in the UI for now");
      }
      if (form.hookMode === "custom") {
        if (!form.customHookSource.trim()) {
          throw new Error("Upload or paste your custom hook Solidity source");
        }
        if (!form.customHookAddress || !isAddress(form.customHookAddress)) {
          throw new Error(
            "Deploy your custom hook first (MineHookAddress.s.sol), then paste its address",
          );
        }
      }

      const bitmask =
        form.hookMode === "custom" ? BigInt(0) : packLaunchBitmask(form.modules, form.creatorTaxBps);
      const metadataURI = buildMetadataUri(form);
      const customHook =
        form.hookMode === "custom" && isAddress(form.customHookAddress)
          ? (form.customHookAddress as Address)
          : zeroAddress;

      const launchFee = onChainLaunchFee ?? BigInt(500_000_000_000_000); // 0.0005 ETH fallback

      const hash = await writeContractAsync({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "launch",
        args: [
          {
            name: form.name.trim(),
            symbol: form.ticker.trim().toUpperCase(),
            metadataURI,
            totalSupply: DEFAULT_TOTAL_SUPPLY,
            quote: zeroAddress,
            tickSpacing: DEFAULT_TICK_SPACING,
            startingTick: DEFAULT_STARTING_TICK,
            bitmask,
            customHook,
          },
        ],
        value: launchFee,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let launchId = BigInt(0);
      let token: Address = zeroAddress;
      let poolId = `0x${"0".repeat(64)}` as `0x${string}`;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: launchFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "TokenLaunched") {
            launchId = decoded.args.launchId as bigint;
            token = decoded.args.token as Address;
            poolId = decoded.args.poolId as `0x${string}`;
            break;
          }
        } catch {
          // unrelated log
        }
      }

      const out: LaunchResult = { launchId, token, poolId, txHash: hash };
      setResult(out);
      return out;
    },
    [factory, onChainLaunchFee, publicClient, writeContractAsync],
  );

  return {
    factoryConfigured: !!factory,
    launchFee: onChainLaunchFee,
    launch,
    isPending,
    error,
    setError,
    result,
    resetResult: () => setResult(null),
  };
}
