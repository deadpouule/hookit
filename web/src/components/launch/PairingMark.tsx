import Image from "next/image";
import type { ReactNode } from "react";

import type { PairingTokenId } from "@/lib/pairing-tokens";
import { cn } from "@/lib/utils";

/** Quotrons Ink stock icons (local mirrors of quotrons.cash/stocks-ink). */
const PAIRING_LOGO_SRC: Partial<Record<PairingTokenId, string>> = {
  usdg: "/pairing/usdg.png",
  waaplx: "/pairing/waaplx.svg",
  wamznx: "/pairing/wamznx.svg",
  wgooglx: "/pairing/wgooglx.svg",
  wmcdx: "/pairing/wmcdx.svg",
  wmstrx: "/pairing/wmstrx.svg",
  wnflxx: "/pairing/wnflxx.svg",
  wnvdax: "/pairing/wnvdax.svg",
  wspyx: "/pairing/wspyx.svg",
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
  const isSvg = src.endsWith(".svg");
  return (
    <Wrap fill={fill} size={size} className="pick-logo--photo">
      {isSvg ? (
        // next/image does not optimize local SVG; Quotrons icons are small SVG marks.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={px} height={px} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <Image
          src={src}
          alt=""
          width={px}
          height={px}
          className="h-full w-full object-cover"
          draggable={false}
        />
      )}
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
    default:
      return null;
  }
}
