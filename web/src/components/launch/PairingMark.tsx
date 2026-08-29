import Image from "next/image";
import type { ReactNode } from "react";

import type { PairingTokenId } from "@/lib/pairing-tokens";
import { cn } from "@/lib/utils";

const PAIRING_LOGO_SRC: Partial<Record<PairingTokenId, string>> = {
  usdg: "/pairing/usdg.png",
  wmstrx: "/pairing/wmstrx.png",
  wnflxx: "/pairing/wnflxx.png",
  wnvdax: "/pairing/wnvdax.png",
  wspyx: "/pairing/wspyx.png",
  wtslax: "/pairing/wtslax.png",
};

function Wrap({
  children,
  fill,
  size = "md",
  className,
}: {
  children: ReactNode;
  fill: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn("pick-logo", size === "sm" && "pick-logo--sm", className)}
      style={{ background: fill }}
    >
      {children}
    </span>
  );
}

function LogoMark({
  id,
  size,
  fill = "transparent",
}: {
  id: PairingTokenId;
  size: "sm" | "md";
  fill?: string;
}) {
  const src = PAIRING_LOGO_SRC[id];
  if (!src) return null;
  const px = size === "sm" ? 20 : 44;
  return (
    <Wrap fill={fill} size={size} className="pick-logo--photo">
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </Wrap>
  );
}

export function PairingMark({
  id,
  size = "md",
}: {
  id: PairingTokenId;
  size?: "sm" | "md";
}) {
  if (PAIRING_LOGO_SRC[id]) {
    return <LogoMark id={id} size={size} />;
  }

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
    default:
      return null;
  }
}
