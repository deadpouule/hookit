import type { BrowseHookId, HookTheme } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

function Glyph({ id }: { id: BrowseHookId }) {
  const stroke = "currentColor";

  switch (id) {
    case "anti-snipe":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="7.2" stroke={stroke} strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.4" fill={stroke} />
          <path
            d="M12 2.6v3.4M12 18v3.4M2.6 12h3.4M18 12h3.4"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "backed-floor":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M14 8h7v3H14zM9 12h12v3H9zM3 16h18v5H3z" fill={stroke} />
        </svg>
      );
    case "anti-mev":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.8" />
          <path d="M8 9.2 10.2 12 8 14.8M16 9.2 13.8 12 16 14.8" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "max-tx":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3.4 8.2 6.6 6.4h4.2L14 8.2v6.2l-3.2 1.8H6.6L3.4 14.4z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 8.2 6.6 6.4" stroke={stroke} strokeWidth="1.6" />
          <path d="M10.2 8.8 13.4 7h4.2L21 8.8v6.2l-3.4 1.8h-4.2l-3.2-1.8z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M16.8 8.8 13.4 7" stroke={stroke} strokeWidth="1.6" />
          <path d="M8.5 11.6h7.2M14.2 10l1.6 1.6-1.6 1.6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "max-wallet":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="7" width="17" height="12" rx="2.2" stroke={stroke} strokeWidth="1.8" />
          <path d="M3.5 10h17" stroke={stroke} strokeWidth="1.8" />
          <circle cx="16.2" cy="14.2" r="1.35" fill={stroke} />
        </svg>
      );
    case "dynamic-fees":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M3.5 16.5 8 10.5l3.2 3.6 4.1-6.4 4.8 5.2"
            stroke={stroke}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M16.2 5.8h4.3V10" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "buyback-vesting":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3.5" width="16" height="17" rx="1.4" stroke={stroke} strokeWidth="1.7" />
          <path d="M8 3.5v17M12 3.5v17M16 3.5v17" stroke={stroke} strokeWidth="1.6" />
          <circle cx="12" cy="9.2" r="1.5" fill={stroke} />
          <path d="M9.6 14.8c0-1.5 1-2.3 2.4-2.3s2.4.8 2.4 2.3" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "auto-burn":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2.8c1.7 2.6 5.2 5.1 5.2 9.1A5.2 5.2 0 0 1 7 11.9C7 8.4 10.2 5.6 12 2.8Z"
            fill={stroke}
            fillOpacity="0.22"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M12 8.2c1 1.6 2.6 2.8 2.6 4.7A2.6 2.6 0 0 1 9.4 13c0-1.7 1.5-3 2.6-4.8Z"
            fill={stroke}
          />
        </svg>
      );
    case "lp-donate":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5.2 8.2c1.6-1.2 3.6-.4 4.3.8.5-1.6 2.3-2.3 3.7-1.4 1.5.9 1.6 2.8.6 4.1L9.6 16.4 5.4 11.4c-.9-1.1-.8-2.3-.2-3.2Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12.1" r="1.15" fill={stroke} />
          <path
            d="M8.6 17.6c1.4 1.6 3.9 1.8 5.6.4l3.6-3c1.1-.9 1.2-2.4.3-3.4"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "holder-airdrop":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="6.2" cy="6.4" r="1.6" fill={stroke} />
          <circle cx="12" cy="5.6" r="1.6" fill={stroke} />
          <circle cx="17.8" cy="6.4" r="1.6" fill={stroke} />
          <path d="M4.6 9.2c.4 1.3 1.3 2 2.6 2s2.2-.7 2.6-2M10.4 8.4c.4 1.3 1.3 2 2.6 2s2.2-.7 2.6-2M14.8 9.2c.4 1.3 1.3 2 2.6 2s2.2-.7 2.6-2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="12" cy="17.2" rx="7.2" ry="3.1" stroke={stroke} strokeWidth="1.7" />
          <path d="M8.4 13.6 12 16.4l3.6-2.8" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "creator-share-to-hook":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="5.2" rx="4.2" ry="1.6" stroke={stroke} strokeWidth="1.7" />
          <circle cx="12" cy="10.2" r="2.2" fill={stroke} />
          <path d="M7.8 18.8c.6-3 2.1-4.4 4.2-4.4s3.6 1.4 4.2 4.4" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "fixed-fee":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6.5 4.4h11L19 7.2H5z" fill={stroke} />
          <rect x="5.2" y="7.2" width="13.6" height="10.4" rx="1.2" stroke={stroke} strokeWidth="1.7" />
          <path d="M8.4 11.2h7.2M8.4 14.4h4.6" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9.6 17.6h4.8V20H9.6z" fill={stroke} />
        </svg>
      );
  }
}

export function HookLogo({
  hookId,
  theme,
  className,
}: {
  hookId: BrowseHookId;
  theme: HookTheme;
  className?: string;
}) {
  return (
    <span className={cn("hook-logo", `hook-logo--${theme}`, className)} aria-hidden>
      <Glyph id={hookId} />
    </span>
  );
}
