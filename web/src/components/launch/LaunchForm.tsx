"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";

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

  const devBuy = parseFloat(form.devBuyEth) || 0;
  const estimatedTokens =
    devBuy > 0 ? `${(devBuy * 8_759_432).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
  const supplyShare = devBuy > 0 ? `${((devBuy * 0.04) * 100).toFixed(2)}%` : "—";
  const floorEst = estimateFloorPrice(form.modules.floorAllocation, devBuy);

  const activeTags = useMemo(() => {
    if (form.hookMode === "custom") return ["Custom Hook"];
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
    <div className="form-shell pt-6 sm:pt-10">
      <Link
        href="/explore"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Create Hooked Token
      </h1>
      <p className="mb-10 text-center text-sm text-zinc-500">
        Fixed launch valuation{" "}
        <span className="font-mono text-zinc-300">${TARGET_LAUNCH_MCAP_USD.toLocaleString()}</span> FDV
        · 1B supply
      </p>

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
              { value: "custom", label: "Custom hook" },
            ]}
          />
        </div>

        {form.hookMode === "custom" ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-zinc-500">
              Upload your Uniswap v4 hook source. Hookit modules are disabled — your contract owns
              all swap logic. Deploy with{" "}
              <code className="font-mono text-zinc-400">MineHookAddress.s.sol</code>, then paste
              the mined address below.
            </p>

            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">Hook source (.sol)</Label>
              <input
                type="file"
                accept=".sol"
                className="field-input cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setForm((p) => ({
                    ...p,
                    customHookSource: text,
                    customHookFileName: file.name,
                  }));
                }}
              />
              {form.customHookFileName && (
                <p className="mt-1 text-xs text-zinc-600">{form.customHookFileName} loaded</p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">Or paste Solidity</Label>
              <textarea
                className="field-textarea min-h-[140px] font-mono text-xs"
                placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.26;&#10;..."
                value={form.customHookSource}
                onChange={(e) =>
                  setForm((p) => ({ ...p, customHookSource: e.target.value, customHookFileName: "" }))
                }
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs text-zinc-500">Deployed hook address</Label>
              <input
                className="field-input font-mono"
                placeholder="0x… after forge script deploy"
                value={form.customHookAddress}
                onChange={(e) => updateField("customHookAddress", e.target.value)}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-600">
            Uses the Hookit MasterLaunchHook — anti-snipe, backed floor, anti-MEV, and quote-only
            fees configured below.
          </p>
        )}

        {form.hookMode === "master" && (
          <>
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
          </>
        )}

        <FormDivider />

        <SectionLabel>Initial buy</SectionLabel>
        <p className="mt-1 text-xs text-amber-500/80">
          Dev buy is not bundled in the launch tx yet — extra ETH is refunded. Swap on the pool
          after launch.
        </p>
        <div className="mt-3 flex gap-3 opacity-50">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0"
              value={form.devBuyEth}
              disabled
              onChange={(e) => updateField("devBuyEth", e.target.value)}
              className="field-input pr-14 font-mono"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-500">ETH</span>
          </div>
          <button
            type="button"
            disabled
            onClick={() => updateField("devBuyEth", "1")}
            className="rounded-xl border border-white/10 px-4 text-sm text-zinc-400"
          >
            Max
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <p>
            Launch fee:{" "}
            <span className="font-mono text-zinc-400">{launchFeeEth} ETH</span>
            {launchFee ? " (on-chain)" : " (default)"}
          </p>
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
          disabled={
            isPending ||
            !form.name ||
            !form.ticker ||
            !walletReady ||
            !factoryConfigured
          }
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!walletReady
            ? "Connect wallet on Base Sepolia"
            : isPending
              ? "Confirm in wallet…"
              : "Hook it & launch"}
        </button>
      </FormPanel>
    </div>
  );
}
