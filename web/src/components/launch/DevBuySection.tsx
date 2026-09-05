"use client";

import { useMemo } from "react";
import { zeroAddress } from "viem";

import { AccentSlider } from "@/components/launch/AccentSlider";
import { Label } from "@/components/ui/label";
import { STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import {
  estimateClassicDevBuyQuoteWei,
  estimateMasterDevBuyQuoteWei,
  fallbackGraduationQuoteWei,
  fallbackMcapQuoteWei,
  formatDevBuyQuoteHint,
  MAX_DEV_BUY_SUPPLY_PCT,
  resolveDevBuyQuoteWei,
} from "@/lib/dev-buy-launch";
import { formatPairingTicker } from "@/lib/pairing-tokens";
import type { LaunchFormState } from "@/lib/types";
import { cn } from "@/lib/utils";

const LAUNCH_VIOLET = "#9514d1";

type Props = {
  form: LaunchFormState;
  variant: "classic" | "custom";
  onChange: (patch: Partial<LaunchFormState>) => void;
};

function resolveQuoteAddress(quoteId: string) {
  if (quoteId === "eth") return zeroAddress;
  if (quoteId === "usdg") return STABLE_QUOTE_ADDRESS;
  return zeroAddress;
}

export function DevBuySection({ form, variant, onChange }: Props) {
  const quoteId = form.markets[0]?.id ?? form.quoteAsset;
  const quote = resolveQuoteAddress(quoteId);
  const payLabel = quoteId === "eth" ? "ETH" : formatPairingTicker(quoteId);
  const rail = variant === "classic" ? "classic" : "master";

  const graduation = fallbackGraduationQuoteWei(quote);
  const mcap = fallbackMcapQuoteWei(quote);

  const maxQuoteWei = useMemo(
    () =>
      rail === "classic"
        ? estimateClassicDevBuyQuoteWei(MAX_DEV_BUY_SUPPLY_PCT, graduation)
        : estimateMasterDevBuyQuoteWei(MAX_DEV_BUY_SUPPLY_PCT, mcap),
    [graduation, mcap, rail],
  );

  const supplyQuoteWei = useMemo(
    () =>
      resolveDevBuyQuoteWei(form, {
        rail,
        quote,
        graduationQuoteWei: graduation,
        mcapQuoteWei: mcap,
      }),
    [form, rail, quote, graduation, mcap],
  );

  const maxHint = formatDevBuyQuoteHint(maxQuoteWei, quote).replace(/^~/, "");

  return (
    <section className="dev-buy-section">
      <p className="pick-heading">
        Dev buy <span className="font-normal text-zinc-500">(optional)</span>
      </p>

      <div className="mt-4">
        <div
          className="launch-mode-toggle launch-mode-toggle--compact"
          role="tablist"
          aria-label="Dev buy input mode"
        >
          {(
            [
              { value: "supply" as const, label: "% of supply" },
              { value: "eth" as const, label: `${payLabel} amount` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={form.devBuyMode === opt.value}
              onClick={() => onChange({ devBuyMode: opt.value })}
              className={cn(
                "launch-mode-toggle__btn launch-mode-toggle__btn--single",
                form.devBuyMode === opt.value && "is-active",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Buy up to {MAX_DEV_BUY_SUPPLY_PCT}% of the supply as the pool&apos;s very first trade — bundled
        atomically with launch so nothing can trade before you. Paid in {payLabel} with the launch fee;
        the tokens land in your wallet the moment the pool is live.
      </p>

      {form.devBuyMode === "supply" ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>0%</span>
            <span className="font-mono text-zinc-300">
              {form.devBuySupplyPct > 0 ? `${form.devBuySupplyPct.toFixed(2)}%` : "Off"}
            </span>
            <span>{MAX_DEV_BUY_SUPPLY_PCT}%</span>
          </div>
          <AccentSlider
            accentColor={LAUNCH_VIOLET}
            value={[form.devBuySupplyPct]}
            onValueChange={([v]) => onChange({ devBuySupplyPct: v })}
            min={0}
            max={MAX_DEV_BUY_SUPPLY_PCT}
            step={0.05}
          />
          {form.devBuySupplyPct > 0 && supplyQuoteWei && supplyQuoteWei > 0n && (
            <p className="mt-2 text-xs text-zinc-500">
              ≈ {formatDevBuyQuoteHint(supplyQuoteWei, quote)} at launch curve
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Label className="mb-1.5 block text-xs text-zinc-500">{payLabel} amount</Label>
          <input
            className="field-input font-mono text-base md:text-sm"
            inputMode="decimal"
            pattern="^[0-9]*[.,]?[0-9]*$"
            autoComplete="off"
            placeholder={`${payLabel} amount, up to ~${maxHint}`}
            value={form.devBuyEth}
            onChange={(e) => onChange({ devBuyEth: e.target.value.replace(/[^\d.]/g, "") })}
          />
        </div>
      )}
    </section>
  );
}
