"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  decodeEventLog,
  type Address,
  type PublicClient,
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
import { bondingFactoryAbi } from "@/lib/contracts/bonding-factory-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import {
  DEFAULT_STARTING_TICK,
  DEFAULT_TICK_SPACING,
  DEFAULT_TOTAL_SUPPLY,
  getBondingFactoryAddress,
  getLaunchFactoryAddress,
  launchGasFloor,
  STABLE_QUOTE_ADDRESS,
} from "@/lib/contracts/config";
import { deployCustomHook } from "@/lib/deploy-custom-hook";
import { buildMinimalOnChainMetadataUri, resolveLaunchImageUri, resolveOnChainMetadataUri } from "@/lib/launch-metadata";
import type { PairingTokenId } from "@/lib/pairing-tokens";
import { toast } from "@/lib/toast";
import type { LaunchFormState } from "@/lib/types";
import { requestLaunchVerification, type VerifyStatus } from "@/lib/verify-launch";
import { wagmiConfig } from "@/lib/wagmi";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";
import { sendTransaction } from "wagmi/actions";

import type { LaunchPhase } from "@/components/launch/LaunchSummary";

export type LaunchRail = "master" | "classic";

export type LaunchResult = {
  launchId: bigint;
  token: Address;
  poolId: `0x${string}`;
  txHash: `0x${string}`;
  customHookAddress?: Address;
  rail: LaunchRail;
};

export type { VerifyStatus };

export function useLaunchToken(rail: LaunchRail = "master") {
  const masterFactory = getLaunchFactoryAddress();
  const bondingFactory = getBondingFactoryAddress();
  const factory = rail === "classic" ? bondingFactory : masterFactory;
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
    abi: rail === "classic" ? bondingFactoryAbi : launchFactoryAbi,
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
          rail === "classic"
            ? "Bonding factory not configured. Set NEXT_PUBLIC_BONDING_FACTORY after deploying."
            : "LaunchFactory not configured. Set NEXT_PUBLIC_LAUNCH_FACTORY after deploying.",
        );
      }
      if (!publicClient) {
        throw new Error("Wallet RPC not ready");
      }
      const primaryMarket = form.markets[0];
      if (!primaryMarket) {
        throw new Error("Select at least one quote market");
      }
      const quote = resolveLaunchQuote(primaryMarket.id);
      if (!quote) {
        throw new Error(`Unsupported quote asset: ${primaryMarket.id}`);
      }
      const marketQuotes = form.markets.map((m) => {
        const q = resolveLaunchQuote(m.id);
        if (!q && m.id !== "eth") {
          throw new Error(`Unsupported quote asset: ${m.id}`);
        }
        return { quote: q ?? zeroAddress, bps: m.bps };
      });
      const bpsTotal = marketQuotes.reduce((sum, m) => sum + m.bps, 0);
      if (bpsTotal !== 10_000) {
        throw new Error("Market weights must total 100%");
      }
      const isMulti = form.markets.length > 1;

      setPhase("launching");
      const loadingId = toast.loading(
        form.imagePreview ? "Uploading image & launching…" : form.hookMode === "custom" ? "Preparing launch…" : "Launching token…",
      );

      try {
      const imageUri = await resolveLaunchImageUri(form.imagePreview);
      let metadataURI = await resolveOnChainMetadataUri(form, imageUri);
      const launchFee = onChainLaunchFee ?? BigInt(500_000_000_000_000);
      let customHookAddress: Address | undefined;
      let hash: `0x${string}`;

      if (rail === "classic") {
        hash = await writeContractAsync({
          address: factory,
          abi: bondingFactoryAbi,
          functionName: "launch",
          args: [
            {
              name: form.name.trim(),
              symbol: form.ticker.trim().toUpperCase(),
              metadataURI,
              totalSupply: BigInt(0),
              quote,
              creatorTaxBps: 0,
            },
          ],
          value: launchFee,
        });
      } else {
        if (form.hookMode === "custom") {
          const analysis = analyzeCustomHookSource(form.customHookSource);
          if (!analysis.valid) {
            throw new Error(analysis.errors[0] ?? "Fix your hook source before launching");
          }
          setPhase("deploying-hook");
          try {
            customHookAddress = await deployCustomHook(form.customHookSource, {
              sendCreate2: async ({ to, data }) =>
                sendTransaction(wagmiConfig, { to, data }),
              waitForReceipt: async (txHash) => {
                await publicClient.waitForTransactionReceipt({ hash: txHash });
              },
            });
          } catch {
            // Server forge create when wallet CREATE2 / prepare fails
            customHookAddress = await deployCustomHook(form.customHookSource);
          }
          setPhase("launching");
        }

        const bitmask =
          form.hookMode === "custom"
            ? BigInt(0)
            : packLaunchBitmask(
                isMulti && form.modules.backedFloor
                  ? { ...form.modules, backedFloor: false }
                  : form.modules,
                form.hookTaxBps,
              );
        const customHook = customHookAddress ?? zeroAddress;

        const masterLaunchFields = {
          name: form.name.trim(),
          symbol: form.ticker.trim().toUpperCase(),
          metadataURI,
          totalSupply: DEFAULT_TOTAL_SUPPLY,
          tickSpacing: DEFAULT_TICK_SPACING,
          bitmask,
          customHook,
        };

        const marketCount = form.markets.length;
        let gas = launchGasFloor(isMulti, marketCount);
        if (creator) {
          try {
            gas = await estimateLaunchGas(
              publicClient,
              factory,
              creator,
              launchFee,
              isMulti,
              marketCount,
              masterLaunchFields,
              marketQuotes,
              quote,
              form.floorQuoteIndex,
            );
          } catch (simErr) {
            const hint = launchSimulationHint(simErr);
            if (hint?.includes("Metadata too large")) {
              metadataURI = buildMinimalOnChainMetadataUri(form, imageUri);
              masterLaunchFields.metadataURI = metadataURI;
              gas = await estimateLaunchGas(
                publicClient,
                factory,
                creator,
                launchFee,
                isMulti,
                marketCount,
                masterLaunchFields,
                marketQuotes,
                quote,
                form.floorQuoteIndex,
              );
            } else if (hint) {
              throw new Error(hint);
            }
            // else keep launchGasFloor when RPC estimate fails transiently
          }
        }

        if (isMulti) {
          hash = await writeContractAsync({
            address: factory,
            abi: launchFactoryAbi,
            functionName: "launchMulti",
            args: [
              {
                ...masterLaunchFields,
                markets: marketQuotes,
                floorQuoteIndex: form.floorQuoteIndex,
              },
            ],
            value: launchFee,
            gas,
          });
        } else {
          hash = await writeContractAsync({
            address: factory,
            abi: launchFactoryAbi,
            functionName: "launch",
            args: [
              {
                ...masterLaunchFields,
                quote,
                startingTick: DEFAULT_STARTING_TICK,
              },
            ],
            value: launchFee,
            gas,
          });
        }
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let launchId = BigInt(0);
      let token: Address = zeroAddress;
      let poolId = `0x${"0".repeat(64)}` as `0x${string}`;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== factory.toLowerCase()) continue;
        try {
          if (rail === "classic") {
            const decoded = decodeEventLog({
              abi: bondingFactoryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "TokenLaunched") {
              launchId = decoded.args.launchId as bigint;
              token = decoded.args.token as Address;
              break;
            }
          } else {
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
        rail,
      };
      setResult(out);
      await queryClient.invalidateQueries({ queryKey: ["launches"] });
      toast.dismiss(loadingId);
      toast.success("Token launched", `${form.ticker.trim().toUpperCase()} · ${hash.slice(0, 10)}…`);

      if (token !== zeroAddress && creator && rail === "master") {
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
      } catch (err) {
        toast.dismiss(loadingId);
        const message = err instanceof Error ? err.message : "Launch failed";
        toast.error("Launch failed", message.slice(0, 140));
        throw err;
      }
    },
    [creator, factory, onChainLaunchFee, publicClient, queryClient, rail, writeContractAsync],
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
    rail,
  };
}

function resolveLaunchQuote(id: PairingTokenId): Address | null {
  if (id === "eth") return zeroAddress;
  if (id === "usdg") return STABLE_QUOTE_ADDRESS as Address;
  const stock = INK_QUOTRON_STOCKS.find((s) => s.symbol.toLowerCase() === id);
  return stock?.address ?? null;
}

function launchSimulationHint(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (/CreateInitCodeSizeLimit|init.?code.?size|#-39004/i.test(msg)) {
    return "Metadata too large for on-chain token deploy. Image/metadata is now pinned to IPFS when configured — retry, or shorten name/description.";
  }
  if (/gas/i.test(msg) && /limit|required|exceed/i.test(msg)) {
    return "Transaction needs more gas (multi-market launches use ~4M gas). Retry — gas is estimated automatically.";
  }
  return null;
}

async function estimateLaunchGas(
  publicClient: PublicClient,
  factory: Address,
  creator: Address,
  launchFee: bigint,
  isMulti: boolean,
  marketCount: number,
  fields: {
    name: string;
    symbol: string;
    metadataURI: string;
    totalSupply: bigint;
    tickSpacing: number;
    bitmask: bigint;
    customHook: Address;
  },
  marketQuotes: { quote: Address; bps: number }[],
  quote: Address,
  floorQuoteIndex: number,
): Promise<bigint> {
  const floor = launchGasFloor(isMulti, marketCount);
  const estimated = isMulti
    ? await publicClient.estimateContractGas({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "launchMulti",
        args: [
          {
            ...fields,
            markets: marketQuotes,
            floorQuoteIndex,
          },
        ],
        value: launchFee,
        account: creator,
      })
    : await publicClient.estimateContractGas({
        address: factory,
        abi: launchFactoryAbi,
        functionName: "launch",
        args: [
          {
            ...fields,
            quote,
            startingTick: DEFAULT_STARTING_TICK,
          },
        ],
        value: launchFee,
        account: creator,
      });
  const buffered = estimated + estimated / 4n;
  return buffered > floor ? buffered : floor;
}
