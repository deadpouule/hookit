"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

import { CustomHookEditor } from "@/components/launch/CustomHookEditor";
import { AccentSlider } from "@/components/launch/AccentSlider";
import { HookModuleCard } from "@/components/launch/HookModuleCard";
import { LaunchSummary } from "@/components/launch/LaunchSummary";
import {
  FeeBreakdown,
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
  MAX_CREATOR_TAX_BPS,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import { BASE_SEPOLIA_EXPLORER } from "@/lib/contracts/config";
import { estimateFloorPrice, formatBps } from "@/lib/format";
import { HOOK_MODULE_ACCENTS } from "@/lib/hook-modules";
import type { HookMode, LaunchFormState, LaunchModules } from "@/lib/types";
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
  } = useLaunchToken();

  const launchFeeEth = launchFee ? Number(formatEther(launchFee)) : LAUNCH_FEE_ETH;

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateModules = (patch: Partial<LaunchModules>) => {
    setForm((prev) => ({ ...prev, modules: { ...prev.modules, ...patch } }));
  };

  const floorEst = estimateFloorPrice(form.modules.floorAllocation, 0);

  const activeTags = useMemo(() => {
    if (form.hookMode === "custom") return ["Custom Hook", "Auto-deploy"];
    const tags: string[] = [];
    if (form.modules.antiSnipe) tags.push("Anti-Snipe");
    if (form.modules.backedFloor) tags.push("Backed Floor");
    if (form.modules.antiMev) tags.push("Anti-MEV");
    if (form.modules.maxWallet) tags.push("Max Wallet");
    if (form.modules.maxTx) tags.push("Max TX");
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
        href="/explore"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to explore
      </Link>

      <div className="mb-10">
        <p className="text-xs text-zinc-600">Base Sepolia</p>
        <h1 className="ink-headline mt-1 text-3xl sm:text-4xl">
          Create <span className="text-degen">token</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm text-zinc-500">
          Fixed{" "}
          <span className="font-mono text-zinc-300">
            ${TARGET_LAUNCH_MCAP_USD.toLocaleString()}
          </span>{" "}
          FDV · 1B supply · Uniswap v4 pool in one transaction.
        </p>
      </div>

      {!factoryConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">LaunchFactory not configured</p>
          <p className="mt-1 text-amber-200/80">
            Deploy contracts to Base Sepolia, then set{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-xs">
              NEXT_PUBLIC_LAUNCH_FACTORY
            </code>{" "}
            in <code className="font-mono text-xs">web/.env.local</code>.
          </p>
        </div>
      )}

      {result && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
          <p className="font-medium">Token launched on Base Sepolia</p>
          <dl className="mt-3 space-y-2 font-mono text-xs">
            {result.customHookAddress && (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-emerald-200/70">Hook</dt>
                <dd>{result.customHookAddress}</dd>
                <a
                  href={`${BASE_SEPOLIA_EXPLORER}/address/${result.customHookAddress}`}
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
                href={`${BASE_SEPOLIA_EXPLORER}/address/${result.token}`}
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
                href={`${BASE_SEPOLIA_EXPLORER}/tx/${result.txHash}`}
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
              Toggle modules below. Fees are collected in ETH, not your token.
            </p>
          )}

          {form.hookMode === "master" && (
            <>
              <FormDivider />

              <SectionLabel>Pool modules</SectionLabel>
              <div className="mt-3 space-y-2.5">
                <HookModuleCard
                  accent={HOOK_MODULE_ACCENTS.antiSnipe}
                  label="Anti-snipe"
                  description="Decay tax on buys at launch"
                  enabled={form.modules.antiSnipe}
                  onToggle={(v) => updateModules({ antiSnipe: v })}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-zinc-500">
                        <span>Duration</span>
                        <span
                          className="font-mono"
                          style={{ color: HOOK_MODULE_ACCENTS.antiSnipe.color }}
                        >
                          {form.modules.antiSnipeDuration}s
                        </span>
                      </div>
                      <AccentSlider
                        accentColor={HOOK_MODULE_ACCENTS.antiSnipe.color}
                        value={[form.modules.antiSnipeDuration]}
                        onValueChange={([v]) => updateModules({ antiSnipeDuration: v })}
                        min={1}
                        max={10}
                        step={1}
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-xs text-zinc-500">
                        <span>Initial tax</span>
                        <span
                          className="font-mono"
                          style={{ color: HOOK_MODULE_ACCENTS.antiSnipe.color }}
                        >
                          {form.modules.antiSnipeInitialTax}%
                        </span>
                      </div>
                      <AccentSlider
                        accentColor={HOOK_MODULE_ACCENTS.antiSnipe.color}
                        value={[form.modules.antiSnipeInitialTax]}
                        onValueChange={([v]) => updateModules({ antiSnipeInitialTax: v })}
                        min={50}
                        max={99}
                        step={1}
                      />
                    </div>
                  </div>
                </HookModuleCard>

                <HookModuleCard
                  accent={HOOK_MODULE_ACCENTS.backedFloor}
                  label="Backed floor"
                  description="Swap fees collateralize a ratchet floor"
                  enabled={form.modules.backedFloor}
                  onToggle={(v) => updateModules({ backedFloor: v })}
                >
                  <div>
                    <div className="mb-2 flex justify-between text-xs text-zinc-500">
                      <span>Fee to floor</span>
                      <span
                        className="font-mono"
                        style={{ color: HOOK_MODULE_ACCENTS.backedFloor.color }}
                      >
                        {form.modules.floorAllocation}%
                      </span>
                    </div>
                    <AccentSlider
                      accentColor={HOOK_MODULE_ACCENTS.backedFloor.color}
                      value={[form.modules.floorAllocation]}
                      onValueChange={([v]) => updateModules({ floorAllocation: v })}
                      min={0}
                      max={50}
                      step={1}
                    />
                    {floorEst > 0 && (
                      <p
                        className="mt-2 font-mono text-xs"
                        style={{ color: `${HOOK_MODULE_ACCENTS.backedFloor.color}cc` }}
                      >
                        Est. floor ≈ {floorEst.toFixed(6)} ETH / token
                      </p>
                    )}
                  </div>
                </HookModuleCard>

                <HookModuleCard
                  accent={HOOK_MODULE_ACCENTS.antiMev}
                  label="Anti-MEV"
                  description="Cooldown on same-block opposing swaps"
                  enabled={form.modules.antiMev}
                  onToggle={(v) => updateModules({ antiMev: v })}
                />

                <HookModuleCard
                  accent={HOOK_MODULE_ACCENTS.maxWallet}
                  label="Max wallet"
                  description="Per-wallet holding cap"
                  enabled={form.modules.maxWallet}
                  onToggle={(v) => updateModules({ maxWallet: v })}
                >
                  <div className="mb-2 flex justify-between text-xs text-zinc-500">
                    <span>Cap</span>
                    <span
                      className="font-mono"
                      style={{ color: HOOK_MODULE_ACCENTS.maxWallet.color }}
                    >
                      {(form.modules.maxWalletBps / 100).toFixed(1)}% supply
                    </span>
                  </div>
                  <AccentSlider
                    accentColor={HOOK_MODULE_ACCENTS.maxWallet.color}
                    value={[form.modules.maxWalletBps / 100]}
                    onValueChange={([v]) => updateModules({ maxWalletBps: Math.round(v * 100) })}
                    min={0.5}
                    max={5}
                    step={0.1}
                  />
                </HookModuleCard>

                <HookModuleCard
                  accent={HOOK_MODULE_ACCENTS.maxTx}
                  label="Max transaction"
                  description="Per-swap size cap"
                  enabled={form.modules.maxTx}
                  onToggle={(v) => updateModules({ maxTx: v })}
                >
                  <div className="mb-2 flex justify-between text-xs text-zinc-500">
                    <span>Cap</span>
                    <span
                      className="font-mono"
                      style={{ color: HOOK_MODULE_ACCENTS.maxTx.color }}
                    >
                      {(form.modules.maxTxBps / 100).toFixed(1)}% supply
                    </span>
                  </div>
                  <AccentSlider
                    accentColor={HOOK_MODULE_ACCENTS.maxTx.color}
                    value={[form.modules.maxTxBps / 100]}
                    onValueChange={([v]) => updateModules({ maxTxBps: Math.round(v * 100) })}
                    min={0.5}
                    max={5}
                    step={0.1}
                  />
                </HookModuleCard>
              </div>

              <FormDivider />

              <SectionLabel>Fees</SectionLabel>
              <p className="mt-1 text-xs text-zinc-600">Quote asset only.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    HOOK_MODULE_ACCENTS.swapFee.border,
                    HOOK_MODULE_ACCENTS.swapFee.bg,
                  )}
                  style={{ boxShadow: `0 0 28px -12px ${HOOK_MODULE_ACCENTS.swapFee.glow}` }}
                >
                  <Label className="mb-1.5 flex items-center gap-2 text-xs text-zinc-400">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: HOOK_MODULE_ACCENTS.swapFee.color }}
                    />
                    Base swap fee
                  </Label>
                  <div className="font-mono text-lg text-white">1.00%</div>
                  <FeeBreakdown creator="0.70%" protocol="0.30%" />
                </div>
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    HOOK_MODULE_ACCENTS.creatorTax.border,
                    HOOK_MODULE_ACCENTS.creatorTax.bg,
                  )}
                  style={{ boxShadow: `0 0 28px -12px ${HOOK_MODULE_ACCENTS.creatorTax.glow}` }}
                >
                  <Label className="mb-1.5 flex items-center gap-2 text-xs text-zinc-400">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: HOOK_MODULE_ACCENTS.creatorTax.color }}
                    />
                    Creator tax
                  </Label>
                  <div className="font-mono text-lg text-white">{formatBps(form.creatorTaxBps)}</div>
                  <div className="mt-3">
                    <AccentSlider
                      accentColor={HOOK_MODULE_ACCENTS.creatorTax.color}
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
