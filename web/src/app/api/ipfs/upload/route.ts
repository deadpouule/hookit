import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 1_500_000;

function parseDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const bytes = Buffer.from(m[2], "base64");
  if (!contentType.startsWith("image/")) return null;
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
  return { contentType, bytes };
}

/**
 * Pin image bytes to IPFS via Pinata when PINATA_JWT is set.
 * Without credentials, returns 503 so the client can fall back to data URI.
 */
export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    return NextResponse.json(
      { error: "IPFS upload not configured", hint: "Set PINATA_JWT" },
      { status: 503 },
    );
  }

  let body: { dataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = typeof body.dataUrl === "string" ? parseDataUrl(body.dataUrl) : null;
  if (!parsed) {
    return NextResponse.json({ error: "Expected image data URL under 1.5MB" }, { status: 400 });
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(parsed.bytes)], { type: parsed.contentType }),
    `hookit-${Date.now()}.png`,
  );
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: `hookit-token-${Date.now()}` }),
  );

  const upstream = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: "Pinata upload failed", detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  const pinned = (await upstream.json()) as { IpfsHash?: string };
  if (!pinned.IpfsHash) {
    return NextResponse.json({ error: "Pinata response missing CID" }, { status: 502 });
  }

  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY?.replace(/\/$/, "") ?? "https://ipfs.io/ipfs";
  const cid = pinned.IpfsHash;
  return NextResponse.json({
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `${gateway}/${cid}`,
  });
}
