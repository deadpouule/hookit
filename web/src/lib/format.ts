export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
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

/** Tight quote amounts for narrow side cards (creator fees, hook stats). */
export function formatCompactQuoteAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs >= 0.0001) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 5, maximumSignificantDigits: 4 });
  }
  if (abs >= 0.000001) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 8, maximumSignificantDigits: 3 });
  }
  return Number(value.toPrecision(2)).toString();
}

/**
 * Vesting / streaming quote amounts. Keeps enough digits that a 1-second
 * linear unlock is visible instead of collapsing to `9.4e-10`.
 */
export function formatLiveQuoteWei(wei: bigint, tokenDecimals: number): string {
  if (wei <= 0n) return "0";
  const decimals = Math.max(0, tokenDecimals);
  const padded = wei.toString().padStart(decimals + 1, "0");
  const split = padded.length - decimals;
  const whole = padded.slice(0, split).replace(/^0+(?=\d)/, "") || "0";
  const frac = padded.slice(split);
  if (whole !== "0") {
    const n = Number(`${whole}.${frac.slice(0, 8)}`);
    return Number.isFinite(n) ? formatCompactQuoteAmount(n) : `${whole}.${frac.slice(0, 4)}`;
  }
  const first = frac.search(/[1-9]/);
  if (first === -1) return "0";
  if (first <= 3) {
    const keep = Math.min(frac.length, Math.max(first + 6, 8));
    return `0.${frac.slice(0, keep).replace(/0+$/, "")}`;
  }
  const digits = (frac.slice(first) + "000000").slice(0, 6);
  const mantissa = `${digits[0]}.${digits.slice(1)}`.replace(/0+$/, "").replace(/\.$/, "");
  return `${mantissa}e-${first + 1}`;
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

export function capitalizeDescription(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function estimateFloorPrice(
  floorAllocation: number,
  devBuyEth: number,
): number {
  const base = devBuyEth > 0 ? devBuyEth * 0.15 : 0.0001;
  return base * (floorAllocation / 100) * 1000;
}
