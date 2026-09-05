"use client";

import { formatCompactUsd } from "@/lib/format";
import { useProtocolStats } from "@/hooks/useProtocolStats";

function compact(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return formatCompactUsd(value);
}

export function MobileStatsRow() {
  const { data } = useProtocolStats();
  const all = data?.windows?.all;
  const day = data?.windows?.["24h"];

  return (
    <dl className="stonk-stats md:hidden">
      <div>
        <dt>Total volume</dt>
        <dd>{compact(all?.totalVolumeUsd)}</dd>
      </div>
      <div>
        <dt>24h volume</dt>
        <dd>{compact(day?.totalVolumeUsd)}</dd>
      </div>
      <div>
        <dt>Protocol revenue</dt>
        <dd>{compact(all?.revenueUsd)}</dd>
      </div>
    </dl>
  );
}
