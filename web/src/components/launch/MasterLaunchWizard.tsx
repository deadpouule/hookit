"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ExternalLink, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

import { CustomHookEditor } from "@/components/launch/CustomHookEditor";
import { DevBuySection } from "@/components/launch/DevBuySection";
import { HookArchitectureSection } from "@/components/launch/HookArchitectureSection";
import { HookModulePicker } from "@/components/launch/HookModulePicker";
import { LaunchSummary, LaunchSummaryCta } from "@/components/launch/LaunchSummary";
import { LaunchWizardNav } from "@/components/launch/LaunchWizardNav";
import { LaunchWizardStepper } from "@/components/launch/LaunchWizardStepper";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { PairingPicker } from "@/components/launch/PairingPicker";
import {
  FormDivider,
  FormPanel,
} from "@/components/ui/form-primitives";
import { Label } from "@/components/ui/label";
import { useWalletReady } from "@/components/wallet/ConnectButton";
import { useLaunchToken } from "@/hooks/useLaunchToken";
import {
  DEFAULT_MASTER_WIZARD_STATE,
  CUSTOM_SOLIDITY_HOOKS_ENABLED,
  DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE,
  LAUNCH_FEE_ETH,
} from "@/lib/constants";
import { BLOCK_EXPLORER_URL, getChainDeployment } from "@/lib/contracts/config";
import { clampDynamicFeeRange } from "@/lib/fee-range";
import { estimateFloorPrice } from "@/lib/format";
import type { HookId } from "@/lib/hook-marks";
import { MASTER_TO_HOOK_MARK } from "@/lib/hook-marks";
import { loadBuilderDraft } from "@/lib/hook-builder";
import { rebalanceFeeRoutes } from "@/lib/hook-fee-route";
import {
  LAUNCH_WIZARD_HOOK_IDS,
  MASTER_LAUNCH_STEPS,
  MASTER_WIZARD_STEP_INTRO,
  MASTER_WIZARD_STEP_SUBTITLES,
  masterHookWizardStep,
} from "@/lib/launch-wizard";
import { HOOK_MODULE_FIELD, MASTER_HOOKS, withMasterHookEnabled } from "@/lib/master-hooks";
import { isModuleEnabled } from "@/lib/launch-module-summary";
import type { LaunchFormState, LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

function validateTokenStep(form: LaunchFormState): string | null {
  if (!form.name.trim()) return "Token name is required.";
  if (!form.ticker.trim()) return "Token symbol is required.";
  if (form.markets.length > 1) {
    const totalBps = form.markets.reduce((sum, market) => sum + market.bps, 0);
    if (totalBps !== 10_000) return "Multi-pair liquidity split must total 100%.";
  }
  return null;
}

export function MasterLaunchWizard() {
  const searchParams = useSearchParams();
  const reviewStep = 5;

  const [step, setStep] = useState(() => {
    const hook = searchParams.get("hook");
    if (hook && MASTER_HOOKS.some((item) => item.id === hook)) {
      return masterHookWizardStep(hook as (typeof MASTER_HOOKS)[number]["id"]);
    }
    return 1;
  });

  const [form, setForm] = useState<LaunchFormState>(() =>
    withMasterHookEnabled(DEFAULT_MASTER_WIZARD_STATE, searchParams.get("hook")),
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
  } = useLaunchToken("master");

  useEffect(() => {
    if (searchParams.get("from") !== "builder") return;
    const draft = loadBuilderDraft();
    if (!draft) return;
    setForm((prev) => ({
      ...prev,
      hookMode: "master",
      modules: { ...prev.modules, ...draft.modules },
      hookTaxBps: draft.hookTaxBps,
    }));
    setDraftLoaded(true);
  }, [searchParams]);

  const launchFeeEth = launchFee ? Number(formatEther(launchFee)) : LAUNCH_FEE_ETH;
  const network = getChainDeployment().networkLabel;
  const stepSubtitle = !result
    ? MASTER_WIZARD_STEP_SUBTITLES[step as keyof typeof MASTER_WIZARD_STEP_SUBTITLES]
    : null;

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateModules = (patch: Partial<LaunchModules>) => {
    setForm((prev) => ({ ...prev, modules: { ...prev.modules, ...patch } }));
  };

  const toggleModule = (id: (typeof MASTER_HOOKS)[number]["id"], next: boolean) => {
    if (id === "creator-share-to-hook" && next) {
      updateModules({ creatorShareToHook: true, buybackVesting: false });
      return;
    }
    if (id === "buyback-vesting" && next) {
      updateModules({ buybackVesting: true, creatorShareToHook: false });
      return;
    }
    if (id === "dynamic-fees" && next) {
      const clamped = clampDynamicFeeRange(
        form.modules.dynamicFeeMinBps ?? 100,
        Math.max(form.modules.dynamicFeeMaxBps ?? 300, 100 + form.hookTaxBps),
      );
      updateModules({
        dynamicFees: true,
        dynamicFeeMinBps: clamped.dynamicFeeMinBps,
        dynamicFeeMaxBps: clamped.dynamicFeeMaxBps,
        dynamicFeeRampUp: form.modules.dynamicFeeRampUp ?? true,
        dynamicFeeVolumeTargetScale:
          form.modules.dynamicFeeVolumeTargetScale ?? DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE,
      });
      setForm((p) => ({ ...p, hookTaxBps: clamped.hookTaxBps }));
      return;
    }
    if (id === "dynamic-fees" && !next) {
      updateModules({ dynamicFees: false });
      setForm((p) => ({ ...p, hookTaxBps: 0 }));
      return;
    }
    if (
      (id === "backed-floor" ||
        id === "auto-burn" ||
        id === "lp-donate" ||
        id === "holder-airdrop") &&
      next
    ) {
      const nextModules = { ...form.modules, [HOOK_MODULE_FIELD[id]]: true };
      updateModules({
        [HOOK_MODULE_FIELD[id]]: true,
        ...rebalanceFeeRoutes(nextModules),
      });
      return;
    }
    if (
      (id === "backed-floor" ||
        id === "auto-burn" ||
        id === "lp-donate" ||
        id === "holder-airdrop") &&
      !next
    ) {
      const nextModules = { ...form.modules, [HOOK_MODULE_FIELD[id]]: false };
      updateModules({
        [HOOK_MODULE_FIELD[id]]: false,
        ...rebalanceFeeRoutes(nextModules),
      });
      return;
    }
    updateModules({ [HOOK_MODULE_FIELD[id]]: next });
  };

  const floorEst = estimateFloorPrice(form.modules.floorAllocation, 0);

  const activeHooks = useMemo(() => {
    if (form.hookMode === "custom") return ["custom"] as HookId[];
    return MASTER_HOOKS.filter((hook) => isModuleEnabled(form.modules, hook.id)).map(
      (hook) => MASTER_TO_HOOK_MARK[hook.id],
    );
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

  const summaryProps = {
    form,
    variant: "custom" as const,
    launchFee,
    launchFeeEth,
    walletReady,
    factoryConfigured,
    isPending,
    phase,
    activeHooks,
    onLaunch: handleLaunch,
  };

  const handleImage = (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) return;
    if (file.size > 1_500_000) {
      setError("Image must be under 1.5MB for IPFS upload.");
      return;
    }
    setError(null);
    setForm((p) => {
      if (p.imagePreview?.startsWith("blob:")) URL.revokeObjectURL(p.imagePreview);
      return { ...p, imagePreview: URL.createObjectURL(file) };
    });
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      const validationError = validateTokenStep(form);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    if (step >= reviewStep) return;
    setStep((current) => Math.min(reviewStep, current + 1));
  };

  const goBack = () => {
    setError(null);
    if (step <= 1) return;
    setStep((current) => Math.max(1, current - 1));
  };

  const handleLaunchAnother = () => {
    resetResult();
    setStep(1);
    setForm(DEFAULT_MASTER_WIZARD_STATE);
  };

  const showWizardChrome = !result && step < reviewStep;

  return (
    <div className={cn("launch-shell launch-wizard-compact", !result && "pt-0 sm:pt-1")}>
      <div className="launch-wizard-top">
        <div className="launch-wizard-top-main">
          <span className="token-type-badge token-type-badge--master token-hooks-count-badge launch-wizard-master-badge">
            <MasterHookGlyph className="token-type-badge-glyph" />
            Master launch
          </span>
          <h1 className="terminal-title mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Create a hooked token
          </h1>
          {step === 1 && !result ? (
            <p className="terminal-title mx-auto mt-1 max-w-lg text-sm font-medium tracking-tight text-zinc-400 sm:text-base">
              {MASTER_WIZARD_STEP_INTRO}
            </p>
          ) : stepSubtitle ? (
            <p className="terminal-title mx-auto mt-1 max-w-xl text-base font-medium tracking-tight text-zinc-400 sm:text-lg">
              {stepSubtitle}
            </p>
          ) : null}
          {draftLoaded && (
            <p className="mx-auto mt-1.5 text-xs text-[#d8b4fe]">Builder draft loaded — modules applied.</p>
          )}
        </div>
      </div>

      {!factoryConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Factory not configured</p>
          <p className="mt-1 text-amber-200/80">
            Deploy contracts, then set{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-xs">
              NEXT_PUBLIC_LAUNCH_FACTORY
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
            onClick={handleLaunchAnother}
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

      {!result && step === reviewStep ? (
        <div className="launch-wizard-review mx-auto max-w-5xl">
          <LaunchWizardStepper steps={MASTER_LAUNCH_STEPS} current={step} className="mb-3" />

          <div className="launch-wizard-review-grid grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,320px)]">
            <LaunchSummary {...summaryProps} showLaunchCta={false} sticky={false} />

            <FormPanel className="launch-wizard-panel launch-wizard-review-devbuy">
              <DevBuySection
                form={form}
                variant="custom"
                onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
              />
            </FormPanel>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <LaunchWizardNav step={step} onBack={goBack} showContinue={false} />
            <LaunchSummaryCta
              form={form}
              variant="custom"
              launchFeeEth={launchFeeEth}
              walletReady={walletReady}
              factoryConfigured={factoryConfigured}
              isPending={isPending}
              phase={phase}
              onLaunch={handleLaunch}
              className="inline-flex px-5 py-2.5"
            />
          </div>
        </div>
      ) : !result ? (
        <div className="launch-wizard-step-shell mx-auto max-w-5xl">
          <LaunchWizardStepper steps={MASTER_LAUNCH_STEPS} current={step} className="mb-2" />

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <FormPanel className="launch-wizard-panel">
              {step === 1 && (
                <>
                  <p className="pick-heading">Token details</p>

                  <div className="mt-3 flex flex-col gap-4 sm:flex-row">
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
                        "flex h-[120px] w-full shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 transition hover:border-white/25 sm:w-[120px]",
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
                          <ImagePlus className="mb-2 h-5 w-5 text-zinc-600" />
                          <span className="px-2 text-center text-[11px] leading-relaxed text-zinc-500">
                            Logo
                            <br />
                            JPG, PNG · 1.5MB
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

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="mb-1 block text-xs text-zinc-500">Name</Label>
                          <input
                            className="field-input"
                            placeholder="My Token"
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-zinc-500">Symbol</Label>
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
                        <Label className="mb-1 block text-xs text-zinc-500">Description</Label>
                        <textarea
                          className="field-textarea launch-wizard-desc"
                          rows={2}
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
                    className="mt-3 flex w-full items-center justify-between border border-white/[0.06] bg-black/30 px-3 py-2.5 text-sm text-zinc-400 transition hover:border-white/10 launch-social-toggle"
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
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {(["twitter", "telegram", "website"] as const).map((field) => (
                            <input
                              key={field}
                              className="field-input"
                              placeholder={
                                field === "twitter"
                                  ? "@handle"
                                  : field === "telegram"
                                    ? "t.me/..."
                                    : "https://"
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
                    compact
                    markets={form.markets}
                    floorQuoteIndex={form.floorQuoteIndex}
                    onMarketsChange={(markets) =>
                      setForm((p) => ({
                        ...p,
                        markets,
                        quoteAsset: markets[0]?.id ?? p.quoteAsset,
                        modules:
                          markets.length > 1 && p.modules.backedFloor
                            ? { ...p.modules, backedFloor: false }
                            : p.modules,
                      }))
                    }
                    onFloorQuoteIndexChange={(floorQuoteIndex) =>
                      setForm((p) => ({ ...p, floorQuoteIndex }))
                    }
                  />
                </>
              )}

              {step === 2 && (
                <>
                  {CUSTOM_SOLIDITY_HOOKS_ENABLED ? (
                    <>
                      <HookArchitectureSection
                        mode={form.hookMode}
                        onChange={(hookMode) => setForm((p) => ({ ...p, hookMode }))}
                      />
                      {form.hookMode === "custom" && (
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
                      )}
                    </>
                  ) : null}

                  {(CUSTOM_SOLIDITY_HOOKS_ENABLED ? form.hookMode === "master" : true) && (
                    <HookModulePicker
                      heading="Protection hooks"
                      hookIds={LAUNCH_WIZARD_HOOK_IDS[2]}
                      configHeading="Configure your hooks below"
                      modules={form.modules}
                      onToggle={toggleModule}
                      onUpdate={updateModules}
                      onHookTaxChange={(hookTaxBps) => setForm((p) => ({ ...p, hookTaxBps }))}
                      floorEst={floorEst}
                      multiMarket={form.markets.length > 1}
                      hookTaxBps={form.hookTaxBps}
                    />
                  )}
                </>
              )}

              {step === 3 && (
                <HookModulePicker
                  heading="Trading fee hooks"
                  hookIds={LAUNCH_WIZARD_HOOK_IDS[3]}
                  includeFixedFee
                  configHeading="Configure your hooks below"
                  modules={form.modules}
                  onToggle={toggleModule}
                  onUpdate={updateModules}
                  onHookTaxChange={(hookTaxBps) => setForm((p) => ({ ...p, hookTaxBps }))}
                  onHookTaxBpsChange={(hookTaxBps) => setForm((p) => ({ ...p, hookTaxBps }))}
                  floorEst={floorEst}
                  multiMarket={form.markets.length > 1}
                  hookTaxBps={form.hookTaxBps}
                />
              )}

              {step === 4 && (
                <HookModulePicker
                  heading="Tokenomics hooks"
                  hookIds={LAUNCH_WIZARD_HOOK_IDS[4]}
                  configHeading="Configure your hooks below"
                  modules={form.modules}
                  onToggle={toggleModule}
                  onUpdate={updateModules}
                  onHookTaxChange={(hookTaxBps) => setForm((p) => ({ ...p, hookTaxBps }))}
                  floorEst={floorEst}
                  multiMarket={form.markets.length > 1}
                  hookTaxBps={form.hookTaxBps}
                />
              )}

              {showWizardChrome && (
                <LaunchWizardNav step={step} onBack={goBack} onContinue={goNext} />
              )}
            </FormPanel>

            <LaunchSummary {...summaryProps} showLaunchCta={false} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
