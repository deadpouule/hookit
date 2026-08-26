"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

import { CustomHookEditor } from "@/components/launch/CustomHookEditor";
import { HookBuilder } from "@/components/builder/HookBuilder";
import { LaunchSummary } from "@/components/launch/LaunchSummary";
import {
  FormDivider,
  FormPanel,
  SectionLabel,
  SegmentedControl,
} from "@/components/ui/form-primitives";
import { Label } from "@/components/ui/label";
import { useWalletReady } from "@/components/wallet/ConnectButton";
import { useLaunchToken } from "@/hooks/useLaunchToken";
import {
  DEFAULT_LAUNCH_STATE,
  LAUNCH_FEE_ETH,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import { getBlockExplorerUrl, getNetworkLabel, getNetworkSubtitle } from "@/lib/chains";
import { loadBuilderDraft } from "@/lib/hook-builder";
import type { HookMode, LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LaunchForm() {
  const [form, setForm] = useState<LaunchFormState>(DEFAULT_LAUNCH_STATE);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const walletReady = useWalletReady();
  const {
    factoryConfigured,
    launchFee,
    launch,
    isPending,
    phase,
    error,
    setError,
    result,
    resetResult,
    verifyStatus,
    verifyError,
  } = useLaunchToken();

  const launchFeeEth = launchFee ? Number(formatEther(launchFee)) : LAUNCH_FEE_ETH;

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const [circuitReady, setCircuitReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "builder") {
      const draft = loadBuilderDraft();
      if (draft) {
        setForm((prev) => ({
          ...prev,
          hookMode: "master",
          modules: draft.modules,
          creatorTaxBps: draft.creatorTaxBps,
        }));
      }
    }
    setCircuitReady(true);
  }, []);

  const activeTags = useMemo(() => {
    if (form.hookMode === "custom") return ["Custom Hook", "Auto-deploy"];
    const tags: string[] = [];
    if (form.modules.antiSnipe) tags.push("Anti-Snipe");
    if (form.modules.backedFloor) tags.push("Backed Floor");
    if (form.modules.antiMev) tags.push("Anti-MEV");
    if (form.modules.maxWallet) tags.push("Max Wallet");
    if (form.modules.maxTx) tags.push("Max TX");
    if (form.modules.autoBurn) tags.push("Auto Burn");
    if (form.modules.lpDonate) tags.push("LP Donate");
    if (form.creatorTaxBps > 0) tags.push("Creator Tax");
    return tags;
  }, [form.hookMode, form.modules, form.creatorTaxBps]);

  const handleLaunch = async () => {
    setError(null);
    try {
      await launch(form);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed — check your wallet";
      setError(message);
    }
  };

  const handleImage = (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) return;
    if (file.size > 60_000) {
      setError("Logo must be under 60KB to store on-chain");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setForm((p) => ({ ...p, imagePreview: result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="launch-shell pt-6 sm:pt-10">
      <Link
        href="/explore"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to explore
      </Link>

      <div className="mb-10">
        <p className="text-xs text-zinc-600">{getNetworkSubtitle()}</p>
        <h1 className="ink-headline mt-1 text-3xl sm:text-4xl">
          Create <span className="text-degen">token</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm text-zinc-500">
          Fixed{" "}
          <span className="font-mono text-zinc-300">
            ${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")}
          </span>{" "}
          FDV · 1B supply · Uniswap v4 pool, swapped on Hookit. Compose modules in the{" "}
          <Link href="/builder" className="text-zinc-400 underline-offset-2 hover:underline">
            hook builder
          </Link>
          , or paste custom Solidity.
        </p>
      </div>

      {!factoryConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">LaunchFactory not configured</p>
          <p className="mt-1 text-amber-200/80">
            Deploy contracts to {getNetworkLabel()}, then set{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-xs">
              NEXT_PUBLIC_LAUNCH_FACTORY
            </code>{" "}
            in <code className="font-mono text-xs">web/.env.local</code>.
          </p>
        </div>
      )}

      {result && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
          <p className="font-medium">Token launched on {getNetworkLabel()}</p>
          <dl className="mt-3 space-y-2 font-mono text-xs">
            {result.customHookAddress && (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-emerald-200/70">Hook</dt>
                <dd>{result.customHookAddress}</dd>
                <a
                  href={`${getBlockExplorerUrl()}/address/${result.customHookAddress}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                >
                  Basescan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-emerald-200/70">Token</dt>
              <dd>{result.token}</dd>
              <a
                  href={`${getBlockExplorerUrl()}/address/${result.token}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
              >
                Basescan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-emerald-200/70">Tx</dt>
              <dd className="truncate">{result.txHash}</dd>
              <a
                href={`${getBlockExplorerUrl()}/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <span className="text-emerald-200/70">Launch ID </span>
              {result.launchId.toString()}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {verifyStatus === "verifying" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />
                  <span className="text-emerald-200/80">Verifying contract source…</span>
                </>
              )}
              {verifyStatus === "verified" && (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-emerald-100">Source verified</span>
                  <a
                    href={`${getBlockExplorerUrl()}/address/${result.token}#code`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                  >
                    View source <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
              {verifyStatus === "failed" && (
                <span className="text-amber-200/90">
                  Launch succeeded, but source verification failed
                  {verifyError ? `: ${verifyError.slice(0, 160)}` : "."} You can still
                  verify later on Basescan.
                </span>
              )}
            </div>
          </dl>
          {result.token && result.token !== "0x0000000000000000000000000000000000000000" && (
            <Link
              href={`/explore/${result.token}`}
              className="btn-primary mt-4 inline-flex text-xs"
            >
              Trade ${form.ticker || "token"}
            </Link>
          )}
          <button
            type="button"
            onClick={resetResult}
            className="mt-4 text-xs text-emerald-300 underline-offset-2 hover:underline"
          >
            Launch another token
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <FormPanel className="ink-glow">
          <SectionLabel>Token details</SectionLabel>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleImage(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex h-[140px] w-full shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 transition hover:border-white/25 sm:w-[140px]",
                form.imagePreview && "border-white/20 p-0",
              )}
            >
              {form.imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imagePreview}
                  alt=""
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <>
                  <ImagePlus className="mb-2 h-6 w-6 text-zinc-600" />
                  <span className="px-3 text-center text-xs leading-relaxed text-zinc-500">
                    Logo
                    <br />
                    JPG, PNG, WebP
                  </span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Name</Label>
                  <input
                    className="field-input"
                    placeholder="My Token"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Symbol</Label>
                  <input
                    className="field-input font-mono uppercase"
                    placeholder="TKN"
                    maxLength={8}
                    value={form.ticker}
                    onChange={(e) => updateField("ticker", e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-zinc-500">Description</Label>
                <textarea
                  className="field-textarea"
                  placeholder="What makes this token hooked?"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSocialsOpen(!socialsOpen)}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 text-sm text-zinc-400 transition hover:border-white/10"
          >
            Social links
            <ChevronDown className={cn("h-4 w-4 transition", socialsOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {socialsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(["twitter", "telegram", "website"] as const).map((field) => (
                    <input
                      key={field}
                      className="field-input"
                      placeholder={
                        field === "twitter" ? "@handle" : field === "telegram" ? "t.me/..." : "https://"
                      }
                      value={form[field]}
                      onChange={(e) => updateField(field, e.target.value)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <FormDivider />

          <SectionLabel>Quote</SectionLabel>
          <div className="mt-3">
            <SegmentedControl<"ETH" | "USDC">
              value={form.quoteAsset}
              onChange={(quoteAsset) => setForm((p) => ({ ...p, quoteAsset }))}
              options={[
                { value: "ETH", label: "ETH" },
                { value: "USDC", label: "USDC" },
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Pair against native ETH or {getNetworkLabel()} USDC. Hook fees are taken in the quote.
          </p>

          <FormDivider />

          <SectionLabel>Hook architecture</SectionLabel>
          <div className="mt-3">
            <SegmentedControl<HookMode>
              value={form.hookMode}
              onChange={(mode) => setForm((p) => ({ ...p, hookMode: mode }))}
              options={[
                { value: "master", label: "Master Hook" },
                { value: "custom", label: "Custom Solidity" },
              ]}
            />
          </div>

          {form.hookMode === "custom" ? (
            <div className="mt-4">
              <CustomHookEditor
                source={form.customHookSource}
                fileName={form.customHookFileName}
                onChange={({ source, fileName }) =>
                  setForm((p) => ({
                    ...p,
                    customHookSource: source,
                    customHookFileName: fileName,
                  }))
                }
              />
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">
              Compose live modules in the circuit. Fees stay in the quote asset.{" "}
              <Link href="/builder" className="text-zinc-400 underline-offset-2 hover:underline">
                Open full builder
              </Link>
            </p>
          )}

          {form.hookMode === "master" && circuitReady && (
            <>
              <FormDivider />
              <SectionLabel>Hook circuit</SectionLabel>
              <p className="mt-1 text-xs text-zinc-600">
                1% base quote fee always. Extra rules pack into the MasterLaunchHook bitmask.
              </p>
              <div className="mt-4">
                <HookBuilder
                  modules={form.modules}
                  creatorTaxBps={form.creatorTaxBps}
                  onChange={({ modules, creatorTaxBps }) =>
                    setForm((p) => ({ ...p, modules, creatorTaxBps }))
                  }
                />
              </div>
            </>
          )}
        </FormPanel>

        <LaunchSummary
          form={form}
          launchFee={launchFee}
          launchFeeEth={launchFeeEth}
          walletReady={walletReady}
          factoryConfigured={factoryConfigured}
          isPending={isPending}
          phase={phase}
          activeTags={activeTags}
          onLaunch={handleLaunch}
        />
      </div>
    </div>
  );
}
