"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ExternalLink, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

import { CustomHookEditor } from "@/components/launch/CustomHookEditor";
import { HookModulePicker } from "@/components/launch/HookModulePicker";
import { LaunchSummary } from "@/components/launch/LaunchSummary";
import { PairingPicker } from "@/components/launch/PairingPicker";
import {
  FeeBreakdown,
  FormDivider,
  FormPanel,
  SectionLabel,
  SegmentedControl,
} from "@/components/ui/form-primitives";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useWalletReady } from "@/components/wallet/ConnectButton";
import { useLaunchToken } from "@/hooks/useLaunchToken";
import {
  DEFAULT_CLASSIC_LAUNCH_STATE,
  DEFAULT_LAUNCH_STATE,
  LAUNCH_FEE_ETH,
  MAX_CREATOR_TAX_BPS,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import { BLOCK_EXPLORER_URL, getChainDeployment } from "@/lib/contracts/config";
import { estimateFloorPrice, formatBps } from "@/lib/format";
import type { HookId } from "@/lib/hook-marks";
import { loadBuilderDraft } from "@/lib/hook-builder";
import { HOOK_MODULE_FIELD, withMasterHookEnabled } from "@/lib/master-hooks";
import type { PairingTokenId } from "@/lib/pairing-tokens";
import type { HookMode, LaunchFormState, LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LaunchForm({ variant = "custom" }: { variant?: "classic" | "custom" }) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LaunchFormState>(() =>
    withMasterHookEnabled(
      variant === "classic" ? DEFAULT_CLASSIC_LAUNCH_STATE : DEFAULT_LAUNCH_STATE,
      variant === "custom" ? searchParams.get("hook") : null,
    ),
  );
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
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
  } = useLaunchToken(variant === "classic" ? "classic" : "master");

  useEffect(() => {
    if (variant !== "custom") return;
    if (searchParams.get("from") !== "builder") return;
    const draft = loadBuilderDraft();
    if (!draft) return;
    setForm((prev) => ({
      ...prev,
      hookMode: "master",
      modules: { ...prev.modules, ...draft.modules },
      creatorTaxBps: draft.creatorTaxBps,
    }));
    setDraftLoaded(true);
  }, [searchParams, variant]);

  const launchFeeEth = launchFee ? Number(formatEther(launchFee)) : LAUNCH_FEE_ETH;
  const network = getChainDeployment().networkLabel;

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateModules = (patch: Partial<LaunchModules>) => {
    setForm((prev) => ({ ...prev, modules: { ...prev.modules, ...patch } }));
  };

  const floorEst = estimateFloorPrice(form.modules.floorAllocation, 0);

  const activeHooks = useMemo(() => {
    if (form.hookMode === "custom") return ["custom"] as HookId[];
    const tags: HookId[] = ["quoteFee"];
    if (form.modules.antiSnipe) tags.push("antiSnipe");
    if (form.modules.backedFloor) tags.push("backedFloor");
    if (form.modules.antiMev) tags.push("antiMev");
    if (form.modules.maxWallet) tags.push("maxWallet");
    if (form.modules.maxTx) tags.push("maxTx");
    return tags;
  }, [form.hookMode, form.modules]);

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
    if (file?.type.startsWith("image/")) {
      setForm((p) => ({ ...p, imagePreview: URL.createObjectURL(file) }));
    }
  };

  return (
    <div className="launch-shell pt-6 sm:pt-10">
      <Link
        href="/launch"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to launch models
      </Link>

      <div className="mb-10 text-center">
        <p className="mb-2 text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
          {variant === "classic" ? "Classic launch" : "Custom launch"}
        </p>
        <h1 className="terminal-title text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {variant === "classic" ? "Create a Classic coin" : "Create a hooked token"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
          Atomic Uniswap v4 launch on {network} ·{" "}
          <span className="font-mono text-zinc-300">
            ${TARGET_LAUNCH_MCAP_USD.toLocaleString()}
          </span>{" "}
          FDV · 1B supply
        </p>
        {draftLoaded && (
          <p className="mx-auto mt-2 text-xs text-[#d8b4fe]">Builder draft loaded — modules applied.</p>
        )}
      </div>

      {!factoryConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Factory not configured</p>
          <p className="mt-1 text-amber-200/80">
            Deploy contracts, then set{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-xs">
              {variant === "classic" ? "NEXT_PUBLIC_BONDING_FACTORY" : "NEXT_PUBLIC_LAUNCH_FACTORY"}
            </code>{" "}
            in <code className="font-mono text-xs">web/.env.local</code>.
          </p>
        </div>
      )}

      {result && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
          <p className="font-medium">Token launched on {network}</p>
          <dl className="mt-3 space-y-2 font-mono text-xs">
            {result.customHookAddress && (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-emerald-200/70">Hook</dt>
                <dd>{result.customHookAddress}</dd>
                <a
                  href={`${BLOCK_EXPLORER_URL}/address/${result.customHookAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-emerald-200/70">Token</dt>
              <dd>{result.token}</dd>
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${result.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
              >
                Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-emerald-200/70">Tx</dt>
              <dd className="truncate">{result.txHash}</dd>
              <a
                href={`${BLOCK_EXPLORER_URL}/tx/${result.txHash}`}
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
          </dl>
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
        <FormPanel>
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

          <PairingPicker
            value={form.quoteAsset}
            onChange={(id: PairingTokenId) => setForm((p) => ({ ...p, quoteAsset: id }))}
          />

          <FormDivider />

          {variant === "classic" ? (
            <>
              <SectionLabel>Fees</SectionLabel>
              <p className="mt-1 text-xs text-zinc-600">
                Standard 1% quote-only swap fee on graduation. Creator tax accrues in quote only.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Base swap fee</Label>
                  <div className="field-input flex items-center bg-black/60 text-zinc-400">1.00%</div>
                  <FeeBreakdown creator="0.70%" protocol="0.30%" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Creator tax</Label>
                  <div className="field-input flex items-center justify-between bg-black/60">
                    <span className="font-mono">{formatBps(form.creatorTaxBps)}</span>
                  </div>
                  <div className="mt-2">
                    <Slider
                      value={[form.creatorTaxBps]}
                      onValueChange={([v]) => setForm((p) => ({ ...p, creatorTaxBps: v }))}
                      min={0}
                      max={MAX_CREATOR_TAX_BPS}
                      step={10}
                    />
                  </div>
                  <FeeBreakdown creator="100%" protocol="0%" />
                </div>
              </div>
            </>
          ) : (
            <>
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
              Pre-built Hookit modules — anti-snipe, backed floor, anti-MEV, and quote-only fees.
              Configure below.
            </p>
          )}

          {form.hookMode === "master" && (
            <>
              <FormDivider />

              <HookModulePicker
                modules={form.modules}
                onToggle={(id, next) => updateModules({ [HOOK_MODULE_FIELD[id]]: next })}
                onUpdate={updateModules}
                floorEst={floorEst}
              />

              <FormDivider />

              <SectionLabel>Fees & rewards</SectionLabel>
              <p className="mt-1 text-xs text-zinc-600">
                Fees deducted in quote asset only — zero sell pressure on your token.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Base swap fee</Label>
                  <div className="field-input flex items-center bg-black/60 text-zinc-400">1.00%</div>
                  <FeeBreakdown creator="0.70%" protocol="0.30%" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-zinc-500">Creator tax</Label>
                  <div className="field-input flex items-center justify-between bg-black/60">
                    <span className="font-mono">{formatBps(form.creatorTaxBps)}</span>
                  </div>
                  <div className="mt-2">
                    <Slider
                      value={[form.creatorTaxBps]}
                      onValueChange={([v]) => setForm((p) => ({ ...p, creatorTaxBps: v }))}
                      min={0}
                      max={MAX_CREATOR_TAX_BPS}
                      step={10}
                    />
                  </div>
                  <FeeBreakdown creator="100%" protocol="0%" />
                </div>
              </div>
            </>
          )}
            </>
          )}
        </FormPanel>

        <LaunchSummary
          form={form}
          variant={variant}
          launchFee={launchFee}
          launchFeeEth={launchFeeEth}
          walletReady={walletReady}
          factoryConfigured={factoryConfigured}
          isPending={isPending}
          phase={phase}
          activeHooks={activeHooks}
          onLaunch={handleLaunch}
        />
      </div>
    </div>
  );
}
