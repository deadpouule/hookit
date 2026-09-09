import type { Metadata } from "next";

import { getDetailPool } from "@/lib/pools";
import { loadLaunchPoolById } from "@/lib/server-launches";
import { SITE_NAME, SITE_URL, TOKEN_OG_SIZE, tokenShareTitle } from "@/lib/site-metadata";
import type { TokenPool } from "@/lib/types";

async function loadPool(id: string): Promise<TokenPool | undefined> {
  const demo = getDetailPool(id);
  if (demo) return demo;
  try {
    return (await loadLaunchPoolById(id)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** WhatsApp / Telegram metadata for a launch token URL. */
export async function tokenShareMetadata(
  id: string,
  pathPrefix: "token" | "explore",
): Promise<Metadata> {
  const pool = await loadPool(id);
  const path = `/${pathPrefix}/${id}`;
  const ogImage = {
    url: `${path}/opengraph-image`,
    width: TOKEN_OG_SIZE.width,
    height: TOKEN_OG_SIZE.height,
    alt: pool ? `${pool.name} ($${pool.ticker})` : "Hookit token",
    type: "image/png",
  };

  if (!pool) {
    const title = "Token - hookit";
    const description = "Trade on Uniswap v4 via Hookit.";
    return {
      title: { absolute: title },
      description,
      openGraph: {
        type: "website",
        locale: "en_US",
        url: `${SITE_URL}${path}`,
        siteName: SITE_NAME,
        title,
        description,
        images: [ogImage],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage.url],
      },
    };
  }

  const title = tokenShareTitle(pool.name, pool.ticker);
  const description = pool.description?.trim() || `Trade $${pool.ticker} on Hookit.`;
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      locale: "en_US",
      url: `${SITE_URL}${path}`,
      siteName: SITE_NAME,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}
