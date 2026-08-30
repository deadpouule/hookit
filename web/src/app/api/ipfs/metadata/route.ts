import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_JSON_BYTES = 512_000;

/**
 * Pin token metadata JSON to IPFS via Pinata when PINATA_JWT is set.
 * Returns a short ipfs:// URI safe for LaunchToken CREATE2 init code.
 */
export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    return NextResponse.json(
      { error: "IPFS upload not configured", hint: "Set PINATA_JWT" },
      { status: 503 },
    );
  }

  let body: { metadata?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.metadata || typeof body.metadata !== "object") {
    return NextResponse.json({ error: "Expected metadata object" }, { status: 400 });
  }

  const serialized = JSON.stringify(body.metadata);
  if (serialized.length === 0 || serialized.length > MAX_JSON_BYTES) {
    return NextResponse.json({ error: "Metadata JSON too large" }, { status: 400 });
  }

  const upstream = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: body.metadata,
      pinataMetadata: { name: `hookit-metadata-${Date.now()}` },
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: "Pinata JSON pin failed", detail: text.slice(0, 500) },
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
