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
          <circle cx="12.7" cy="5.55" r="0.38" fill={stroke} />
          <circle cx="13.55" cy="5.7" r="0.38" fill={stroke} />
          <circle cx="15" cy="3.15" r="0.38" fill={stroke} />
          <circle cx="15.85" cy="3.25" r="0.38" fill={stroke} />
          <circle cx="17.15" cy="3.35" r="0.38" fill={stroke} />
          <circle cx="18" cy="3.55" r="0.38" fill={stroke} />
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
            d="M12 2.15c-0.95-1.05-2.65-.22-2.55 1.2 0 1.4 2.55 2.85 2.55 2.85s2.55-1.45 2.55-2.85C14.65 1.93 12.95 1.1 12 2.15Z"
            fill={stroke}
            fillOpacity="0.28"
            stroke={stroke}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path d="M6.15 14.9 4.05 12.7a1.2 1.2 0 0 1 1.7-1.7L7.55 14.2" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7.2 14.25V11.55a1.2 1.2 0 0 1 2.4 0v2.7" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M9.85 13.6V10.7a1.3 1.3 0 0 1 2.6 0v2.9" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12.7 13.5V10.15a1.3 1.3 0 1 1 2.6 0V13.5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M15.55 13.7v-2.25a1.25 1.25 0 1 1 2.5 0V15" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          <path
            d="M7.2 14.4c-1.05.2-2.15 1.15-2.05 2.35.1 1.15 1.05 1.8 2.1 2.25L8.4 21.2c.85.7 2 1.1 3.15 1.1h2.05c2.85 0 5.1-1.85 5.1-4.7v-2.7"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "holder-airdrop":
      return (
        <svg viewBox="0 0 24 24" fill="none">
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
