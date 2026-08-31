import { LaunchpadHomeClient } from "@/components/home/LaunchpadHomeClient";
import { loadLaunchesResponse } from "@/lib/server-launches";

export async function LaunchpadHome() {
  let initialPools: Awaited<ReturnType<typeof loadLaunchesResponse>>["pools"] = [];
  try {
    const data = await loadLaunchesResponse();
    initialPools = data.pools;
  } catch {
    /* client will refetch */
  }

  return <LaunchpadHomeClient initialPools={initialPools} />;
}
