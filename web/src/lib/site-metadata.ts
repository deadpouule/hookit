import type { Metadata } from "next";

export const SITE_URL = "https://www.hookit.fun";
export const SITE_NAME = "Hookit";
export const SITE_DESCRIPTION =
  "Permissionless modular launchpad on Ink. Dual-rail Master + Classic bonding, Quotrons wStocks, locked LP, quote-only fees.";

/** Homepage / generic link preview (WhatsApp / Telegram / X). 1200×630 JPEG. */
export const SITE_OG_IMAGE = {
  url: "/brand/og.jpg",
  width: 1200,
  height: 630,
  alt: "Hookit.fun",
} as const;

export const TOKEN_OG_SIZE = { width: 1200, height: 1200 } as const;

/** Pons-style share title: `vitalik ($BIT) - hookit`. */
export function tokenShareTitle(name: string, ticker: string): string {
  const n = name.trim() || ticker.trim() || "Token";
  const t = ticker.trim() || n;
  return `${n} ($${t}) - hookit`;
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
