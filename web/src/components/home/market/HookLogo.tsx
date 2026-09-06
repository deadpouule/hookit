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
            d="M2.2 19 6.6 13.4 9.6 16.2 14.2 7.6"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12.4 10 13.6 8M13.8 11 15.2 8.6" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" />
          <path d="M17.2 8.4 22.2 2.8" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M18.4 2.2 22.6 2.4 21.6 6.4Z" fill={stroke} />
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
          <rect x="9.6" y="1.2" width="4.8" height="2.2" rx="0.8" stroke={stroke} strokeWidth="1.4" />
          <rect x="7.4" y="3.2" width="9.2" height="3.6" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <path d="M7.4 5.1 5.2 6.6c-.7.45-.65 1.35.15 1.7L7.4 9" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
          <path
            d="M8 6.8v2.5M10.3 6.8v2.8M13.7 6.8v2.8M16 6.8v2.5"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <path d="M12 10.6v4.6" stroke={stroke} strokeWidth="1.55" strokeLinecap="round" />
          <path
            d="M13.75 11.5c0-.75-.8-1.2-1.75-1.2s-1.75.4-1.75 1.1c0 1.55 3.5.7 3.5 2.3 0 .75-.8 1.25-1.75 1.25s-1.8-.5-1.8-1.25"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse cx="12" cy="18.35" rx="8.1" ry="2.05" stroke={stroke} strokeWidth="1.55" />
          <path d="M4 18.35c.5 2.4 3.6 4.05 8 4.05s7.5-1.65 8-4.05" stroke={stroke} strokeWidth="1.55" />
        </svg>
      );
    case "holder-airdrop":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="3.3" r="1.45" fill={stroke} />
          <circle cx="4.1" cy="7.8" r="1.45" fill={stroke} />
          <circle cx="19.9" cy="7.8" r="1.45" fill={stroke} />
          <path
            d="M10 5.9c.4-1 1.2-1.5 2-1.5s1.6.5 2 1.5M2.5 10.3c.35-1 1.05-1.5 1.6-1.5s1.25.5 1.6 1.5M18.3 10.3c.35-1 1.05-1.5 1.6-1.5s1.25.5 1.6 1.5"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinecap="round"
          />
          <ellipse cx="12" cy="16.6" rx="7.6" ry="3.5" stroke={stroke} strokeWidth="1.65" />
          <path d="M12 11.2v4.4" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M13.45 12.15c0-.65-.7-1.05-1.45-1.05s-1.45.35-1.45.95c0 1.35 2.9.6 2.9 2 0 .65-.7 1.1-1.45 1.1s-1.5-.45-1.5-1.1"
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M10.6 13.4 6.6 10.2M13.4 13.4 17.4 10.2"
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
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
          <path d="M6 2.5h8.4L19.2 7.4v14.1H6z" stroke={stroke} strokeWidth="1.65" strokeLinejoin="round" />
          <path d="M14.4 2.5v4.9h4.8" stroke={stroke} strokeWidth="1.65" strokeLinejoin="round" />
          <path d="M14.4 2.5 19.2 7.4h-4.8z" fill={stroke} fillOpacity="0.28" />
          <path d="M8.3 10h7.5M8.3 12.6h7.5M8.3 15.1h5.1" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M8.1 18.6c1.4-2.05 2.35 1.15 3.6-.4 1.15-1.4 1.9.95 3.3.05"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M8.2 19.7h7.6" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" />
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
