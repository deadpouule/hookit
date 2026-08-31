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
          <path
            d="M7 8h10M14 5l3 3-3 3M17 16H7M10 13l-3 3 3 3"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "holderAirdrop":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M12 4v3M8 7h8l1.5 3H6.5L8 7Z"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <rect x="6" y="10" width="12" height="10" rx="1.5" stroke={stroke} strokeWidth="1.7" />
          <path d="M12 10v10M6 14h12" stroke={stroke} strokeWidth="1.7" />
        </svg>
      );
    case "dynamicFees":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path d="M4 16 8 8l4 6 3-4 5 6" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
          <circle cx="9" cy="12" r="4.2" stroke={stroke} strokeWidth="1.7" />
          <circle cx="15" cy="12" r="4.2" stroke={stroke} strokeWidth="1.7" />
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
