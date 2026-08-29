import type { ReactNode } from "react";

import type { PairingTokenId } from "@/lib/pairing-tokens";
import { cn } from "@/lib/utils";

function Wrap({
  children,
  fill,
  size = "md",
}: {
  children: ReactNode;
  fill: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn("pick-logo", size === "sm" && "pick-logo--sm")}
      style={{ background: fill }}
    >
      {children}
    </span>
  );
}

export function PairingMark({
  id,
  size = "md",
}: {
  id: PairingTokenId;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-4 w-4" : "h-7 w-7";
  switch (id) {
    case "eth":
      return (
        <Wrap fill="#627eea" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#fff" fillOpacity="0.92" d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z" />
          </svg>
        </Wrap>
      );
    case "usdg":
      return (
        <Wrap fill="#16a34a" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="1.6" />
            <path d="M12 6.5v11M9.2 9.2c.6-1 1.6-1.5 2.8-1.5 1.8 0 3 1 3 2.4 0 2.4-5.6 1.4-5.6 4.2 0 1.4 1.2 2.5 3.1 2.5 1.3 0 2.3-.5 2.9-1.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Wrap>
      );
    case "waaplx":
      return (
        <Wrap fill="#f5f5f7" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#111" d="M16.2 12.4c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1 1-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.1 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.6-3.9Zm-2.4-7c.7-.8 1.1-1.9 1-3-.9.1-2 .7-2.7 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2-.6 2.7-1.4Z" />
          </svg>
        </Wrap>
      );
    case "wamznx":
      return (
        <Wrap fill="#232f3e" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <text x="12" y="13" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="ui-sans-serif, system-ui">a</text>
            <path d="M6.5 16.2c3.2 1.8 7.8 1.9 11.2.2" fill="none" stroke="#ff9900" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Wrap>
      );
    case "wgooglx":
      return (
        <Wrap fill="#fff" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#4285F4" d="M21.4 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.3c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5C4.8 19.7 8.1 22 12 22Z" />
            <path fill="#FBBC05" d="M6.4 13.1c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V6.8H3.1C2.4 8.3 2 10.1 2 12s.4 3.7 1.1 5.2l3.3-4.1Z" />
            <path fill="#EA4335" d="M12 5.7c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 1.9 14.7 1 12 1 8.1 1 4.8 3.3 3.1 6.8l3.3 2.5C7.2 7.5 9.4 5.7 12 5.7Z" />
          </svg>
        </Wrap>
      );
    case "wmstrx":
      return (
        <Wrap fill="#f97316" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#fff" d="M5 18V6h3.1l3.9 7.2L15.9 6H19v12h-2.8V10.2L12.3 18h-.7L7.8 10.2V18H5Z" />
          </svg>
        </Wrap>
      );
    case "wnflxx":
      return (
        <Wrap fill="#e50914" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#fff" d="M7 4h3.2l3.4 9.4V4H17v16h-3.2L10.4 10.6V20H7V4Z" />
          </svg>
        </Wrap>
      );
    case "wnvdax":
      return (
        <Wrap fill="#76b900" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#111" d="M12 5c4.4 0 7.2 2.3 8 6.5-1.5-2.5-3.7-3.7-6.6-3.7-3.8 0-6.6 2.6-6.6 6.2 0 1.3.4 2.4 1.1 3.3C6.5 15.4 5.5 13 5.5 10.2 5.5 7 8.2 5 12 5Zm0 5.2c2.3 0 3.9 1.5 3.9 3.6 0 2.2-1.6 3.7-3.9 3.7s-3.9-1.5-3.9-3.7c0-2.1 1.6-3.6 3.9-3.6Z" />
          </svg>
        </Wrap>
      );
    case "wspyx":
      return (
        <Wrap fill="#2563eb" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path d="M5 16.5 9.2 11l3.1 3.2L19 7.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.2 7.5H19v3.7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Wrap>
      );
    case "wtslax":
      return (
        <Wrap fill="#cc0000" size={size}>
          <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
            <path fill="#fff" d="M4.5 7.2h15l-1.3 1.8H13.1v9.2h-2.2V9H5.8L4.5 7.2Z" />
          </svg>
        </Wrap>
      );
  }
}
