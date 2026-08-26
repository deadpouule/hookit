import { ProtocolStatsPage } from "@/components/stats/ProtocolStatsPage";

export const metadata = {
  title: "Stats | hook it",
  description:
    "Protocol stats: HOOK buyback and burn, supply burned, launch volume, and master hooks.",
};

export default function StatsPage() {
  return <ProtocolStatsPage />;
}
