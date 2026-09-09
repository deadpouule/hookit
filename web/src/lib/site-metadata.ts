import type { Metadata } from "next";

export const SITE_URL = "https://www.hookit.fun";
export const SITE_NAME = "Hookit";
export const SITE_DESCRIPTION =
  "Permissionless modular launchpad on Ink. Dual-rail Master + Classic bonding, Quotrons wStocks, locked LP, quote-only fees.";

/** Link-preview image (WhatsApp / Telegram / X). 1200×630 JPEG. */
export const SITE_OG_IMAGE = {
  url: "/brand/og.jpg",
  width: 1200,
  height: 630,
  alt: "Hookit.fun",
} as const;

export function socialMetadata(title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      locale: "en_US",
      url: SITE_URL,
      siteName: SITE_NAME,
      title,
      description,
      images: [SITE_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SITE_OG_IMAGE.url],
    },
  };
}
