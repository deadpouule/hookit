import { LaunchpadHomeClient } from "@/components/home/LaunchpadHomeClient";
import { loadLaunchesResponse } from "@/lib/server-launches";

export async function LaunchpadHome() {
  let initialPools: Awaited<ReturnType<typeof loadLaunchesResponse>>["pools"] = [];
  try {
    const res = await loadLaunchesResponse();
    initialPools = res.pools ?? [];
  } catch {
    /* client refetch via useLaunches */
  }
  return <LaunchpadHomeClient initialPools={initialPools} />;
}
