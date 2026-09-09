import { ImageResponse } from "next/og";

import { getDetailPool } from "@/lib/pools";
import { loadLaunchPoolById } from "@/lib/server-launches";
import { TOKEN_OG_SIZE } from "@/lib/site-metadata";
import { isSafeRemoteMetadataUrl, isTokenMediaUri, resolveMediaUrl } from "@/lib/token-metadata";

export const TOKEN_OG_TYPE = "image/png";

async function loadArt(image: string | undefined): Promise<string | ArrayBuffer | null> {
  if (!isTokenMediaUri(image)) return null;
  const url = resolveMediaUrl(image);
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  if (!isSafeRemoteMetadataUrl(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 24 || buf.byteLength > 5_000_000) return null;
    return buf;
  } catch {
    return null;
  }
}

function Fallback({ ticker }: { ticker: string }) {
  const letter = (ticker || "H").slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        width: TOKEN_OG_SIZE.width,
        height: TOKEN_OG_SIZE.height,
        background: "#000000",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: 420,
        fontWeight: 700,
        letterSpacing: "-0.06em",
      }}
    >
      {letter}
    </div>
  );
}

/** Square token art for WhatsApp / Telegram (same-origin PNG). */
export async function tokenOpenGraphImage(id: string) {
  let pool = getDetailPool(id);
  if (!pool) {
    try {
      pool = (await loadLaunchPoolById(id)) ?? undefined;
    } catch {
      pool = undefined;
    }
  }
  const art = pool ? await loadArt(pool.image) : null;
  if (art) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: TOKEN_OG_SIZE.width,
            height: TOKEN_OG_SIZE.height,
            background: "#000000",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og canvas */}
          <img
            src={art as unknown as string}
            alt=""
            width={TOKEN_OG_SIZE.width}
            height={TOKEN_OG_SIZE.height}
            style={{ objectFit: "cover", width: 1200, height: 1200 }}
          />
        </div>
      ),
      { ...TOKEN_OG_SIZE },
    );
  }
  return new ImageResponse(<Fallback ticker={pool?.ticker ?? "H"} />, { ...TOKEN_OG_SIZE });
}
