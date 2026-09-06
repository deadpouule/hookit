"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HookId } from "@/lib/hook-marks";
import { HOOK_MARKS } from "@/lib/hook-marks";
import { hookMarkTooltipText } from "@/lib/launch-module-summary";
import type { LaunchModules } from "@/lib/types";
import { cn } from "@/lib/utils";

function Glyph({ id }: { id: HookId }) {
  const stroke = "currentColor";
  switch (id) {
    case "antiSnipe":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <circle cx="12" cy="12" r="7.5" stroke={stroke} strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.2" fill={stroke} />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "backedFloor":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M5 10.5V8l7-4 7 4v2.5c0 5-3.2 8.4-7 9.5-3.8-1.1-7-4.5-7-9.5Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M8.5 12.2h7M12 12.2V16" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "antiMev":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M13 3 6.5 13h5L11 21l6.5-10h-5L13 3Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "maxWallet":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <rect x="3.5" y="7" width="17" height="12" rx="2.2" stroke={stroke} strokeWidth="1.7" />
          <path d="M3.5 10h17" stroke={stroke} strokeWidth="1.7" />
          <circle cx="16.2" cy="14.2" r="1.3" fill={stroke} />
        </svg>
      );
    case "maxTx":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <rect x="1.4" y="8.8" width="8" height="7.6" rx="0.5" stroke={stroke} strokeWidth="1.55" />
          <path d="M1.4 8.8 5.4 12.1 9.4 8.8" stroke={stroke} strokeWidth="1.55" strokeLinejoin="round" />
          <rect x="14.6" y="8.8" width="8" height="7.6" rx="0.5" stroke={stroke} strokeWidth="1.55" />
          <path d="M14.6 8.8 18.6 12.1 22.6 8.8" stroke={stroke} strokeWidth="1.55" strokeLinejoin="round" />
          <path d="M12 5.6v12.8" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" />
          <path
            d="M14.7 7.7c0-1.35-1.2-2.2-2.7-2.2S9.3 6.35 9.3 7.6c0 2.9 5.4 1.3 5.4 4.25 0 1.35-1.25 2.3-2.7 2.3s-2.75-.95-2.75-2.3"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "holderAirdrop":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <circle cx="12" cy="3.3" r="1.45" fill={stroke} />
          <circle cx="4.1" cy="7.8" r="1.45" fill={stroke} />
          <circle cx="19.9" cy="7.8" r="1.45" fill={stroke} />
          <ellipse cx="12" cy="16.6" rx="7.6" ry="3.5" stroke={stroke} strokeWidth="1.65" />
          <path d="M12 11.2v4.4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M13.45 12.15c0-.65-.7-1.05-1.45-1.05s-1.45.35-1.45.95c0 1.35 2.9.6 2.9 2 0 .65-.7 1.1-1.45 1.1s-1.5-.45-1.5-1.1"
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "dynamicFees":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M2.2 19 6.6 13.4 9.6 16.2 14.2 7.6"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M17.2 8.4 22.2 2.8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18.4 2.2 22.6 2.4 21.6 6.4Z" fill={stroke} />
        </svg>
      );
    case "buybackVesting":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path d="M8 4h8l-1.5 7H9.5L8 4Zm1.5 7L8 20h8l-1.5-9" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "autoBurn":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M12 3c2.2 3.2 5 5.4 5 8.4A5 5 0 0 1 7 11.4C7 8.4 9.8 6.2 12 3Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "lpDonate":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <rect x="9.6" y="1.2" width="4.8" height="2.2" rx="0.8" stroke={stroke} strokeWidth="1.4" />
          <rect x="7.4" y="3.2" width="9.2" height="3.6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <path
            d="M8 6.8v2.5M10.3 6.8v2.8M13.7 6.8v2.8M16 6.8v2.5"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <path d="M12 10.6v4.6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M13.75 11.5c0-.75-.8-1.2-1.75-1.2s-1.75.4-1.75 1.1c0 1.55 3.5.7 3.5 2.3 0 .75-.8 1.25-1.75 1.25s-1.8-.5-1.8-1.25"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <ellipse cx="12" cy="18.35" rx="8.1" ry="2.05" stroke={stroke} strokeWidth="1.5" />
          <path d="M4 18.35c.5 2.4 3.6 4.05 8 4.05s7.5-1.65 8-4.05" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "creatorShareToHook":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path d="M5 12h10M12 7l5 5-5 5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "custom":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path d="M8 8 4.5 12 8 16M16 8l3.5 4L16 16" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.2 6.5 10.8 17.5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "quoteFee":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M12 4c4 5 6 8.2 6 11a6 6 0 1 1-12 0c0-2.8 2-6 6-11Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function HookChipTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        showArrow={false}
        className="max-w-[260px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function HookMark({
  id,
  size = "md",
  className,
}: {
  id: HookId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const def = HOOK_MARKS[id];
  const dim = size === "sm" ? "h-5 w-5 rounded-md" : size === "lg" ? "h-12 w-12 rounded-xl" : "h-9 w-9 rounded-lg";

  return (
    <span
      className={cn("inline-flex items-center justify-center text-black", dim, className)}
      style={{ background: def.color, boxShadow: `0 0 16px ${def.glow}` }}
      title={def.label}
    >
      <Glyph id={id} />
    </span>
  );
}

export function HookChip({
  id,
  className,
  modules,
  hookTaxBps = 0,
  tip,
}: {
  id: HookId;
  className?: string;
  modules?: LaunchModules;
  hookTaxBps?: number;
  tip?: string;
}) {
  const def = HOOK_MARKS[id];
  const resolvedTip = tip ?? hookMarkTooltipText(id, modules, hookTaxBps);
  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 pr-2 text-[10px] font-medium",
        className,
      )}
      style={{
        borderColor: `${def.color}40`,
        background: `${def.color}14`,
        color: def.color,
      }}
    >
      <HookMark id={id} size="sm" className="shadow-none" />
      {def.short}
    </span>
  );

  return <HookChipTip tip={resolvedTip}>{chip}</HookChipTip>;
}

export function HookTile({
  id,
  active,
  onClick,
}: {
  id: HookId;
  active?: boolean;
  onClick?: () => void;
}) {
  const def = HOOK_MARKS[id];
  const inner = (
    <>
      <HookMark id={id} size="md" />
      <span className="mt-2 text-[11px] font-medium text-zinc-200">{def.short}</span>
    </>
  );

  const cls = cn(
    "flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-2.5 py-3 transition",
    active
      ? "border-white/20 bg-white/[0.06]"
      : "border-white/[0.06] bg-black/30 hover:border-white/15 hover:bg-white/[0.04]",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
        {inner}
      </button>
    );
  }

  return <div className={cls}>{inner}</div>;
}
