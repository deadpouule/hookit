"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  decodeEventLog,
  type Address,
  zeroAddress,
} from "viem";
import {
  useAccount,
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
  USDC_ADDRESS,
} from "@/lib/contracts/config";
import { deployCustomHook } from "@/lib/deploy-custom-hook";
import { buildMetadataUri } from "@/lib/launch-metadata";
import type { LaunchFormState } from "@/lib/types";
import { requestLaunchVerification, type VerifyStatus } from "@/lib/verify-launch";

import type { LaunchPhase } from "@/components/launch/LaunchSummary";

export type LaunchResult = {
  launchId: bigint;
  token: Address;
  poolId: `0x${string}`;
  txHash: `0x${string}`;
  customHookAddress?: Address;
};

export type { VerifyStatus };

export function useLaunchToken() {
  const factory = getLaunchFactoryAddress();
  const publicClient = usePublicClient();
  const { address: creator } = useAccount();
  const queryClient = useQueryClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyGen = useRef(0);

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
      setVerifyStatus("idle");
      setVerifyError(null);

      if (!factory) {
        throw new Error(
          "LaunchFactory not configured. Set NEXT_PUBLIC_LAUNCH_FACTORY in web/.env.local after deploying.",
        );
      }
      if (!publicClient) {
        throw new Error("Wallet RPC not ready");
      }
      if (form.quoteAsset !== "ETH" && form.quoteAsset !== "USDC") {
        throw new Error("Quote must be ETH or USDC");
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
            quote: form.quoteAsset === "USDC" ? USDC_ADDRESS : zeroAddress,
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
      await queryClient.invalidateQueries({ queryKey: ["launches"] });

      if (token !== zeroAddress && creator) {
        const gen = ++verifyGen.current;
        setVerifyStatus("verifying");
        void requestLaunchVerification({
          token,
          name: form.name.trim(),
          symbol: form.ticker.trim().toUpperCase(),
          totalSupply: DEFAULT_TOTAL_SUPPLY.toString(),
          creator,
          factory,
          metadataURI,
          customHook: customHookAddress,
        })
          .then(() => {
            if (verifyGen.current === gen) setVerifyStatus("verified");
          })
          .catch((err) => {
            if (verifyGen.current !== gen) return;
            setVerifyStatus("failed");
            setVerifyError(err instanceof Error ? err.message : "Verification failed");
          });
      }

      return out;
    },
    [creator, factory, onChainLaunchFee, publicClient, queryClient, writeContractAsync],
  );

  const resetResult = useCallback(() => {
    verifyGen.current += 1;
    setResult(null);
    setPhase("idle");
    setVerifyStatus("idle");
    setVerifyError(null);
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
    verifyStatus,
    verifyError,
  };
}
