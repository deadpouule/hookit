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
          <rect x="2" y="2.6" width="20" height="13.2" rx="1.6" stroke={stroke} strokeWidth="1.7" />
          <path
            d="M4.6 5.6h3.3M4.6 7.7h3.3M4.6 9.8h3.3M4.6 11.9h3.3"
            stroke={stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M16.1 5.6h3.3M16.1 7.7h3.3M16.1 9.8h3.3M16.1 11.9h3.3"
            stroke={stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path d="M12 4.6v10.2" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
          <path
            d="M14.35 6.35c0-1.15-1.05-1.85-2.35-1.85S9.65 5.2 9.65 6.25c0 2.45 4.7 1.1 4.7 3.6 0 1.15-1.1 1.95-2.35 1.95s-2.4-.8-2.4-1.95"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M3.2 20.1h17.6" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <rect x="16.1" y="18.15" width="2.6" height="3.9" rx="0.45" fill={stroke} />
        </svg>
      );
    case "holderAirdrop":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path d="M3.8 10.2C3.8 5.4 7.4 2.2 12 2.2s8.2 3.2 8.2 8Z" fill={stroke} />
          <path
            d="M5.6 10.2 9.1 16.6M9.4 10.2 10.5 16.6M14.6 10.2 13.5 16.6M18.4 10.2 14.9 16.6"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <rect x="8.2" y="16.4" width="7.6" height="5.2" rx="0.45" fill={stroke} />
          <rect x="7.6" y="16.15" width="8.8" height="1.45" rx="0.3" fill={stroke} />
        </svg>
      );
    case "dynamicFees":
      return (
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
          <path
            d="M1.6 13.6C3.2 10.8 4.8 10.6 6 13.2C7.2 16.6 8.8 17.6 10.6 14.2C12.4 6.6 14 3.6 16.2 3.8C18.4 4 20.2 8 22.4 12.2"
            stroke={stroke}
            strokeWidth="1.85"
            strokeLinecap="round"
          />
          <path d="M2 20.6h20" stroke={stroke} strokeWidth="1.55" strokeLinecap="round" />
          <path
            d="M3.2 12.8V20.6M5.4 14.4V20.6M7.6 16.8V20.6M9.6 16.2V20.6M11.6 10.4V20.6M13.6 5.4V20.6M15.6 3.9V20.6M17.6 5.8V20.6M19.6 9.2V20.6M21.4 11.6V20.6"
            stroke={stroke}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <rect x="12.05" y="6.15" width="2.35" height="1.45" rx="0.35" fill={stroke} transform="rotate(-38 13.2 6.9)" />
          <rect x="14.15" y="3.55" width="2.35" height="1.45" rx="0.35" fill={stroke} transform="rotate(-8 15.3 4.3)" />
          <rect x="16.35" y="3.85" width="2.35" height="1.45" rx="0.35" fill={stroke} transform="rotate(16 17.5 4.6)" />
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
          <path
            d="M12 1.85c-2.3-2.5-6.55-.55-6.3 3.05 0 3.55 6.3 7.5 6.3 7.5s6.3-3.95 6.3-7.5C18.55 1.3 14.3-.65 12 1.85Z"
            fill={stroke}
            fillOpacity="0.22"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <rect x="6.55" y="12.55" width="2.25" height="4.7" rx="1.12" stroke={stroke} strokeWidth="1.55" />
          <rect x="9.15" y="12.05" width="2.25" height="5.2" rx="1.12" stroke={stroke} strokeWidth="1.55" />
          <rect x="11.75" y="11.85" width="2.25" height="5.4" rx="1.12" stroke={stroke} strokeWidth="1.55" />
          <rect x="14.35" y="12.25" width="2.25" height="5" rx="1.12" stroke={stroke} strokeWidth="1.55" />
          <path
            d="M6.5 16.1C4.35 15.15 3.15 13.35 3.55 11.75c.35-1.25 1.75-1.8 2.9-1.15"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <rect x="6.2" y="16.55" width="11.5" height="4.15" rx="1.55" stroke={stroke} strokeWidth="1.6" />
          <path d="M9.1 20.7h5.8" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
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
