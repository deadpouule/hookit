"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

import { DevBuySection } from "@/components/launch/DevBuySection";
import { LaunchSummary } from "@/components/launch/LaunchSummary";
import { PairingPicker } from "@/components/launch/PairingPicker";
import { FormDivider, FormPanel, SectionLabel } from "@/components/ui/form-primitives";
import { Label } from "@/components/ui/label";
import { useWalletReady } from "@/components/wallet/ConnectButton";
import { useLaunchToken } from "@/hooks/useLaunchToken";
import { DEFAULT_CLASSIC_LAUNCH_STATE, LAUNCH_FEE_ETH } from "@/lib/constants";
import { BLOCK_EXPLORER_URL, getChainDeployment } from "@/lib/contracts/config";
import type { HookId } from "@/lib/hook-marks";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Classic bonding-curve launch — original single-page form (unchanged). */
export function ClassicLaunchForm() {
  const [form, setForm] = useState<LaunchFormState>(DEFAULT_CLASSIC_LAUNCH_STATE);
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
  } = useLaunchToken("classic");

  const launchFeeEth = launchFee ? Number(formatEther(launchFee)) : LAUNCH_FEE_ETH;
  const network = getChainDeployment().networkLabel;

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const activeHooks = useMemo(() => [] as HookId[], []);

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
          Classic launch
        </p>
        <h1 className="terminal-title text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Create a Classic coin
        </h1>
      </div>

      {!factoryConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Factory not configured</p>
          <p className="mt-1 text-amber-200/80">
            Deploy contracts, then set{" "}
            <code className="rounded bg-black/30 px-1 font-mono text-xs">
              NEXT_PUBLIC_BONDING_FACTORY
            </code>{" "}
            in <code className="font-mono text-xs">web/.env.local</code>.
          </p>
        </div>
      )}

      {result && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
          <p className="font-medium">Token launched on {network}</p>
          <dl className="mt-3 space-y-2 font-mono text-xs">
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
            onClick={() => {
              resetResult();
              setForm(DEFAULT_CLASSIC_LAUNCH_STATE);
            }}
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
                    JPG, PNG · max 1.5MB
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
                  placeholder="Describe your token — story, utility, or community."
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSocialsOpen(!socialsOpen)}
            className="mt-4 flex w-full items-center justify-between border border-white/[0.06] bg-black/30 px-4 py-3 text-sm text-zinc-400 transition hover:border-white/10 launch-social-toggle"
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
            variant="classic"
            markets={form.markets}
            floorQuoteIndex={form.floorQuoteIndex}
            onMarketsChange={(markets) =>
              setForm((p) => ({
                ...p,
                markets,
                quoteAsset: markets[0]?.id ?? p.quoteAsset,
              }))
            }
            onFloorQuoteIndexChange={(floorQuoteIndex) =>
              setForm((p) => ({ ...p, floorQuoteIndex }))
            }
          />

          <FormDivider />

          <DevBuySection
            form={form}
            variant="classic"
            onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
          />
        </FormPanel>

        <LaunchSummary
          form={form}
          variant="classic"
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
