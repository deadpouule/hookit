"use client";

import { useCallback, useState } from "react";
import {
  decodeEventLog,
  type Address,
  zeroAddress,
} from "viem";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";

import { analyzeCustomHookSource } from "@/lib/custom-hook";
import { packLaunchBitmask } from "@/lib/bitmask";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import {
  DEFAULT_STARTING_TICK,
  DEFAULT_TICK_SPACING,
  DEFAULT_TOTAL_SUPPLY,
  getLaunchFactoryAddress,
} from "@/lib/contracts/config";
import { deployCustomHook } from "@/lib/deploy-custom-hook";
import { buildMetadataUri } from "@/lib/launch-metadata";
import type { LaunchFormState } from "@/lib/types";

import type { LaunchPhase } from "@/components/launch/LaunchSummary";

export type LaunchResult = {
  launchId: bigint;
  token: Address;
  poolId: `0x${string}`;
  txHash: `0x${string}`;
  customHookAddress?: Address;
};

export function useLaunchToken() {
  const factory = getLaunchFactoryAddress();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [phase, setPhase] = useState<LaunchPhase>("idle");

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
      setPhase("idle");

      if (!factory) {
        throw new Error(
          "LaunchFactory not configured. Set NEXT_PUBLIC_LAUNCH_FACTORY in web/.env.local after deploying.",
        );
      }
      if (!publicClient) {
        throw new Error("Wallet RPC not ready");
      }
      if (form.quoteAsset !== "eth") {
        throw new Error(
          "On-chain launches currently quote in ETH. Wrapped stock pairs and USDG are selectable in the form but not wired to the factory yet.",
        );
      }

      let customHookAddress: Address | undefined;

      if (form.hookMode === "custom") {
        const analysis = analyzeCustomHookSource(form.customHookSource);
        if (!analysis.valid) {
          throw new Error(analysis.errors[0] ?? "Fix your hook source before launching");
        }

        setPhase("deploying-hook");
        customHookAddress = await deployCustomHook(form.customHookSource);
      }

      const bitmask =
        form.hookMode === "custom" ? BigInt(0) : packLaunchBitmask(form.modules, form.creatorTaxBps);
      const metadataURI = buildMetadataUri(form);
      const customHook = customHookAddress ?? zeroAddress;

      const launchFee = onChainLaunchFee ?? BigInt(500_000_000_000_000);

      setPhase("launching");
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

      setPhase("done");
      const out: LaunchResult = {
        launchId,
        token,
        poolId,
        txHash: hash,
        customHookAddress,
      };
      setResult(out);
      return out;
    },
    [factory, onChainLaunchFee, publicClient, writeContractAsync],
  );

  const resetResult = useCallback(() => {
    setResult(null);
    setPhase("idle");
  }, []);

  return {
    factoryConfigured: !!factory,
    launchFee: onChainLaunchFee,
    launch,
    isPending,
    phase,
    error,
    setError,
    result,
    resetResult,
  };
}
