import type { Metadata } from "next";

export const SITE_URL = "https://www.hookit.fun";
export const SITE_NAME = "Hookit";
export const SITE_DESCRIPTION =
  "Permissionless modular launchpad on Ink. Dual-rail Master + Classic bonding, Quotrons wStocks, locked LP, quote-only fees.";

/** Browser tab / apple icon. Padded circular owl coin (not a boxed square). */
export const SITE_FAVICON = "/brand/hookit-owl-favicon.png?v=3";
export const SITE_FAVICON_SVG = "/brand/hookit-owl-favicon.svg?v=3";
export const SITE_FAVICON_32 = "/brand/hookit-owl-favicon-32.png?v=3";

/** Homepage / generic link preview (WhatsApp / Telegram / X). Hookit × Ink banner. */
export const SITE_OG_IMAGE = {
  url: "/brand/og.png?v=4",
  width: 1772,
  height: 592,
  alt: "Hookit × Ink",
} as const;

export const TOKEN_OG_SIZE = { width: 1200, height: 1200 } as const;

/** Pons-style share title: `vitalik ($BIT) · hookit`. */
export function tokenShareTitle(name: string, ticker: string): string {
  const n = name.trim() || ticker.trim() || "Token";
  const t = ticker.trim() || n;
  return `${n} ($${t}) · hookit`;
}

export function socialMetadata(
  title: string,
  description: string,
  opts?: { url?: string; images?: { url: string; width: number; height: number; alt: string }[] },
): Pick<Metadata, "openGraph" | "twitter"> {
  const images = opts?.images ?? [SITE_OG_IMAGE];
  return {
    openGraph: {
      type: "website",
      locale: "en_US",
      url: opts?.url ?? SITE_URL,
      siteName: SITE_NAME,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((img) => img.url),
    },
  };
}
