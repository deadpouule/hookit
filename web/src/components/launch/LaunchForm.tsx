"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  FeeBreakdown,
  FormDivider,
  FormPanel,
  ModuleRow,
  SectionLabel,
  SegmentedControl,
} from "@/components/ui/form-primitives";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_LAUNCH_STATE,
  LAUNCH_FEE_ETH,
  MAX_CREATOR_TAX_BPS,
} from "@/lib/constants";
import { estimateFloorPrice, formatBps } from "@/lib/format";
import type { HookMode, LaunchFormState, LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LaunchForm() {
  const [form, setForm] = useState<LaunchFormState>(DEFAULT_LAUNCH_STATE);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateField = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateModules = (patch: Partial<LaunchModules>) => {
    setForm((prev) => ({ ...prev, modules: { ...prev.modules, ...patch } }));
  };

  const devBuy = parseFloat(form.devBuyEth) || 0;
  const estimatedTokens =
    devBuy > 0 ? `${(devBuy * 8_759_432).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
  const supplyShare = devBuy > 0 ? `${((devBuy * 0.04) * 100).toFixed(2)}%` : "—";
  const floorEst = estimateFloorPrice(form.modules.floorAllocation, devBuy);

  const activeTags = useMemo(() => {
    const tags: string[] = [];
    if (form.modules.antiSnipe) tags.push("Anti-Snipe");
    if (form.modules.backedFloor) tags.push("Backed Floor");
    if (form.modules.antiMev) tags.push("Anti-MEV");
    if (form.modules.maxWallet) tags.push("Max Wallet");
    if (form.modules.maxTx) tags.push("Max TX");
    return tags;
  }, [form.modules]);

  const handleLaunch = async () => {
    setLaunching(true);
    await new Promise((r) => setTimeout(r, 1800));
    setLaunching(false);
    alert(`Launch queued for $${form.ticker || "TOKEN"} on Base Sepolia`);
  };

  const handleImage = (file: File | undefined) => {
    if (file?.type.startsWith("image/")) {
      setForm((p) => ({ ...p, imagePreview: URL.createObjectURL(file) }));
    }
  };

  return (
    <div className="form-shell pt-6 sm:pt-10">
      <Link
        href="/explore"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mb-10 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Create Hooked Token
      </h1>

      <FormPanel>
        <SectionLabel>Token</SectionLabel>

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
                  Choose image
                  <br />
                  JPG, PNG or WebP
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
                <Label className="mb-1.5 block text-xs text-zinc-500">Token name</Label>
                <input
                  className="field-input"
                  placeholder="My Token"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-zinc-500">Ticker</Label>
                <input
                  className="field-input font-mono uppercase"
                  placeholder="TKN"
                  value={form.ticker}
                  onChange={(e) => updateField("ticker", e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">Description</Label>
              <textarea
                className="field-textarea"
                placeholder="Optional"
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
          Project links
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
                    placeholder={field === "twitter" ? "@handle" : field === "telegram" ? "t.me/..." : "https://"}
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
              { value: "custom", label: "Custom address" },
            ]}
          />
        </div>
        {form.hookMode === "custom" && (
          <input
            className="field-input mt-3 font-mono"
            placeholder="0x… hook contract"
            value={form.customHookAddress}
            onChange={(e) => updateField("customHookAddress", e.target.value)}
          />
        )}

        <FormDivider />

        <SectionLabel>Hook modules</SectionLabel>
        <div className="mt-2">
          <ModuleRow
            label="Anti-snipe shield"
            description="Decay tax on buys at launch"
            enabled={form.modules.antiSnipe}
            onToggle={(v) => updateModules({ antiSnipe: v })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex justify-between text-xs text-zinc-500">
                  <span>Duration</span>
                  <span className="font-mono text-zinc-300">{form.modules.antiSnipeDuration}s</span>
                </div>
                <Slider
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
                  <span className="font-mono text-zinc-300">{form.modules.antiSnipeInitialTax}%</span>
                </div>
                <Slider
                  value={[form.modules.antiSnipeInitialTax]}
                  onValueChange={([v]) => updateModules({ antiSnipeInitialTax: v })}
                  min={50}
                  max={99}
                  step={1}
                />
              </div>
            </div>
          </ModuleRow>

          <ModuleRow
            label="Backed floor vault"
            description="Collateralized ratchet floor"
            enabled={form.modules.backedFloor}
            onToggle={(v) => updateModules({ backedFloor: v })}
          >
            <div>
              <div className="mb-2 flex justify-between text-xs text-zinc-500">
                <span>Fee to floor</span>
                <span className="font-mono text-zinc-300">{form.modules.floorAllocation}%</span>
              </div>
              <Slider
                value={[form.modules.floorAllocation]}
                onValueChange={([v]) => updateModules({ floorAllocation: v })}
                min={0}
                max={50}
                step={1}
              />
              {floorEst > 0 && (
                <p className="mt-2 font-mono text-xs text-emerald-500/80">
                  Est. floor ≈ {floorEst.toFixed(6)} ETH / token
                </p>
              )}
            </div>
          </ModuleRow>

          <ModuleRow
            label="Anti-MEV guard"
            description="Same-block opposing swap cooldown"
            enabled={form.modules.antiMev}
            onToggle={(v) => updateModules({ antiMev: v })}
          />

          <ModuleRow
            label="Max wallet"
            enabled={form.modules.maxWallet}
            onToggle={(v) => updateModules({ maxWallet: v })}
          >
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>Cap</span>
              <span className="font-mono text-zinc-300">
                {(form.modules.maxWalletBps / 100).toFixed(1)}% supply
              </span>
            </div>
            <Slider
              value={[form.modules.maxWalletBps / 100]}
              onValueChange={([v]) => updateModules({ maxWalletBps: Math.round(v * 100) })}
              min={0.5}
              max={5}
              step={0.1}
            />
          </ModuleRow>

          <ModuleRow
            label="Max transaction"
            enabled={form.modules.maxTx}
            onToggle={(v) => updateModules({ maxTx: v })}
          >
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>Cap</span>
              <span className="font-mono text-zinc-300">
                {(form.modules.maxTxBps / 100).toFixed(1)}% supply
              </span>
            </div>
            <Slider
              value={[form.modules.maxTxBps / 100]}
              onValueChange={([v]) => updateModules({ maxTxBps: Math.round(v * 100) })}
              min={0.5}
              max={5}
              step={0.1}
            />
          </ModuleRow>
        </div>

        <FormDivider />

        <SectionLabel>Fees and rewards</SectionLabel>
        <p className="mt-1 text-xs text-zinc-600">
          All fees deducted in quote asset only — zero sell pressure on your token.
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

        <FormDivider />

        <SectionLabel>Initial buy</SectionLabel>
        <div className="mt-3 flex gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0"
              value={form.devBuyEth}
              onChange={(e) => updateField("devBuyEth", e.target.value)}
              className="field-input pr-14 font-mono"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-500">ETH</span>
          </div>
          <button
            type="button"
            onClick={() => updateField("devBuyEth", "1")}
            className="rounded-xl border border-white/10 px-4 text-sm text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            Max
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <p>Minimum {LAUNCH_FEE_ETH} ETH launch fee</p>
          <p>
            Estimated tokens = <span className="font-mono text-zinc-400">{estimatedTokens}</span>
          </p>
          <p>
            Share of supply = <span className="font-mono text-zinc-400">{supplyShare}</span>
          </p>
        </div>

        {activeTags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {activeTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching || !form.name || !form.ticker}
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {launching ? "Launching…" : "Hook it & launch"}
        </button>
      </FormPanel>
    </div>
  );
}
