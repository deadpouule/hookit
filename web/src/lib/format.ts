export function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatEth(value: number): string {
  return `${value.toFixed(value < 1 ? 4 : 2)} ETH`;
}

export function formatPercent(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
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
