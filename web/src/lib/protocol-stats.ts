import { MOCK_METRICS, MOCK_POOLS } from "@/lib/constants";
import { MASTER_HOOKS } from "@/lib/master-hooks";

export const NATIVE_TOKEN = "HOOK";
export const NATIVE_SUPPLY = 1_000_000_000;
export const NATIVE_BURNED = 24_180_440;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface StatsChartPoint {
  hour: number;
  value: number;
  burns: number;
  label: string;
}

export interface BurnTx {
  hash: `0x${string}`;
  wallet: string;
  amount: number;
  heldFor: string;
  multiple: string;
  at: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Deterministic CEST label (UTC+2) so SSR and client match. */
function labelForHour(hour: number) {
  const utcMs = Date.UTC(2026, 7, 16, 8, 0) + hour * 3_600_000;
  const cest = new Date(utcMs + 2 * 3_600_000);
  return `${cest.getUTCDate()} ${MONTHS[cest.getUTCMonth()]}, ${pad(cest.getUTCHours())}:${pad(cest.getUTCMinutes())} CEST`;
}

function buildBurnSeries(): StatsChartPoint[] {
  const points: StatsChartPoint[] = [];
  let value = 0.412;
  for (let i = 0; i < 48; i++) {
    value += i % 5 === 0 ? 0.014 : 0.0032;
    if (i % 11 === 0) value += 0.018;
    const hour = i * 5;
    points.push({
      hour,
      value: Number(value.toFixed(4)),
      burns: 1 + (i % 5),
      label: labelForHour(hour),
    });
  }
  return points;
}

export const BURN_SERIES = buildBurnSeries();

export const BURN_TXS: BurnTx[] = [
  { hash: "0x7a1c9e2b4d88f01a3c55e90b12d4aa1098c3e21f0ab44c77d1e9083a6b2c4d11", wallet: "0x0789...22A4", amount: 182_400, heldFor: "3h 59m", multiple: "16x", at: "20 Aug, 22:10 CEST" },
  { hash: "0x12b0aa4419c8e77d03f1b90e5c2a44d9810e33c7ab6f09d1c4e8a2b7d6c5f001", wallet: "0xA31F...9c10", amount: 96_200, heldFor: "1h 12m", multiple: "9x", at: "20 Aug, 21:04 CEST" },
  { hash: "0x98ee01c4d2aa11bf09c3d8e7a6b5c4012233445566778899aabbccddeeff0011", wallet: "0x44d0...1B8C", amount: 410_000, heldFor: "11h 02m", multiple: "35x", at: "20 Aug, 19:41 CEST" },
  { hash: "0x0c55aa1199e8d7c6b5a443221100ffeeddccbbaa99887766554433221100aa11", wallet: "0xB017...6e2A", amount: 12_800, heldFor: "4m", multiple: "3x", at: "20 Aug, 18:22 CEST" },
  { hash: "0x55aa11bb22cc33dd44ee55ff6677889900aabbccddeeff001122334455667788", wallet: "0x9fC2...04E1", amount: 221_050, heldFor: "6h 18m", multiple: "12x", at: "20 Aug, 16:55 CEST" },
  { hash: "0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", wallet: "0x2e90...C71d", amount: 8_440, heldFor: "1s", multiple: "2x", at: "20 Aug, 16:11 CEST" },
  { hash: "0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0001", wallet: "0x71Aa...B903", amount: 64_900, heldFor: "2h 07m", multiple: "7x", at: "20 Aug, 14:40 CEST" },
  { hash: "0xdead000111122223333444455556666777788889999aaaabbbbccccddddeee1", wallet: "0xC4b8...11F0", amount: 305_600, heldFor: "1d 3h", multiple: "21x", at: "19 Aug, 23:08 CEST" },
  { hash: "0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabca", wallet: "0x08E4...77a2", amount: 19_330, heldFor: "22m", multiple: "4x", at: "19 Aug, 21:51 CEST" },
  { hash: "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20", wallet: "0xF19c...D04b", amount: 150_000, heldFor: "8h 44m", multiple: "11x", at: "19 Aug, 18:02 CEST" },
  { hash: "0x21f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100", wallet: "0x6d11...A8e3", amount: 47_200, heldFor: "5h 01m", multiple: "6x", at: "19 Aug, 15:20 CEST" },
  { hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", wallet: "0xE02b...4c19", amount: 88_750, heldFor: "14h 33m", multiple: "18x", at: "19 Aug, 11:48 CEST" },
  { hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", wallet: "0x19c0...7F2e", amount: 3_110, heldFor: "41s", multiple: "1x", at: "19 Aug, 09:05 CEST" },
  { hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", wallet: "0xB8aa...D031", amount: 260_400, heldFor: "2d 4h", multiple: "28x", at: "18 Aug, 22:17 CEST" },
  { hash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", wallet: "0x03e7...91Bb", amount: 51_900, heldFor: "9h 12m", multiple: "8x", at: "18 Aug, 19:40 CEST" },
  { hash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", wallet: "0xAa14...C6d8", amount: 17_660, heldFor: "1h 55m", multiple: "5x", at: "18 Aug, 16:02 CEST" },
];

export function protocolOverview() {
  const burnedPct = (NATIVE_BURNED / NATIVE_SUPPLY) * 100;
  const last = BURN_SERIES[BURN_SERIES.length - 1];

  return {
    nativeToken: NATIVE_TOKEN,
    totalSupply: NATIVE_SUPPLY,
    burned: NATIVE_BURNED,
    burnedPct,
    remaining: NATIVE_SUPPLY - NATIVE_BURNED,
    launchVolumeUsd: MOCK_METRICS.totalVolume,
    launches: MOCK_POOLS.length,
    masterHooks: MASTER_HOOKS.length,
    buybacks: 1_396,
    latestWindow: 100,
    buybackEth: last?.value ?? 0,
  };
}
