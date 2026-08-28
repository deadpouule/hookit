import {
  BASE_FEE_BPS,
  FLYWHEEL_SHARE_BPS,
  PROTOCOL_SHARE_BPS,
} from "@/lib/constants";

/** Quote leg volume → protocol fee USD (1% base × 30% protocol share). */
export function protocolRevenueFromVolumeUsd(volumeUsd: number): number {
  if (!Number.isFinite(volumeUsd) || volumeUsd <= 0) return 0;
  return volumeUsd * (BASE_FEE_BPS / 10_000) * (PROTOCOL_SHARE_BPS / 10_000);
}

/** Protocol revenue → flywheel buyback USD (80% of protocol share). */
export function buybackFromProtocolRevenueUsd(revenueUsd: number): number {
  if (!Number.isFinite(revenueUsd) || revenueUsd <= 0) return 0;
  return revenueUsd * (FLYWHEEL_SHARE_BPS / 10_000);
}

export function buybackFromVolumeUsd(volumeUsd: number): number {
  return buybackFromProtocolRevenueUsd(protocolRevenueFromVolumeUsd(volumeUsd));
}
