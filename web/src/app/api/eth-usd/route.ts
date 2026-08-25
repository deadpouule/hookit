import { getLaunchFactoryAddress } from "@/lib/contracts/config";
import { readEthUsd } from "@/lib/eth-usd";
import { createServerPublicClient } from "@/lib/server-rpc";
import type { PublicClient } from "viem";

export const revalidate = 30;

export async function GET() {
  try {
    const client = createServerPublicClient() as PublicClient;
    const ethUsd = await readEthUsd(client);
    return Response.json({ ethUsd, factory: getLaunchFactoryAddress() ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read ETH/USD";
    return Response.json({ error: message }, { status: 502 });
  }
}
