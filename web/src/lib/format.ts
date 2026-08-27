export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatCompactUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatFullUsd(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}`;
}

export function formatTokenAmount(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  const days = Math.floor(seconds / 86400);
  if (days < 60) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

/** Unix seconds only — rejects launch ids / zero placeholders. */
export function isValidLaunchTimestamp(ts?: number | null): ts is number {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 1_000_000_000;
}

export function formatEth(value: number): string {
  return `${value.toFixed(value < 1 ? 4 : 2)} ETH`;
}

export function formatPercent(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  const abs = Math.abs(value);
  if (abs >= 100) return `${prefix}${value >= 0 ? "" : "-"}${abs.toFixed(0)}%`;
  return `${prefix}${value.toFixed(2)}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-chars)}`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function estimateFloorPrice(
  floorAllocation: number,
  devBuyEth: number,
): number {
  const base = devBuyEth > 0 ? devBuyEth * 0.15 : 0.0001;
  return base * (floorAllocation / 100) * 1000;
}
