import type { LaunchFormState, ProtocolMetrics, TokenPool } from "./types";

export const LAUNCH_FEE_ETH = 0.0005;
export const TARGET_LAUNCH_MCAP_USD = 4_000;
export const DEFAULT_LAUNCH_ETH_USD = 4_000;
/** Classic bonding graduation target (~4.2 ETH or USD-equivalent). */
export const GRADUATION_ETH = 4.2;
export const BASE_FEE_BPS = 100;
export const CREATOR_SHARE_BPS = 7000;
export const PROTOCOL_SHARE_BPS = 3000;
export const OPS_SHARE_BPS = 2000;
export const FLYWHEEL_SHARE_BPS = 8000;
/** Max hook tax so base (1%) + tax ≤ 10% total steady fee. */
export const MAX_HOOK_TAX_BPS = 900;
export const MAX_TOTAL_FEE_BPS = 1000;
/** Default total fee cap when enabling dynamic fees (3%). */
export const DYNAMIC_FEE_DEFAULT_MAX_BPS = 300;
/** Default depth consumption (bps) for max dynamic fee — 100% of in-range quote depth. */
export const DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS = 10_000;
export const DYNAMIC_FEE_MIN_DEPTH_SATURATION_PCT = 10;
export const DYNAMIC_FEE_MAX_DEPTH_SATURATION_PCT = 100;
export const BUYBACK_VESTING_DEFAULT_DAYS = 365 * 5;
export const BUYBACK_VESTING_MIN_DAYS = 7;
export const BUYBACK_VESTING_MAX_DAYS = 365 * 5;
export const SECONDS_PER_DAY = 86_400;

/** Max % of total supply per swap / wallet — mirrors ProtocolConstants (10_000 bps = 100%). */
export { MIN_SUPPLY_CAP_BPS, MAX_SUPPLY_CAP_BPS } from "@/lib/protocol-limits";

/** Upload-your-own Solidity hooks — disabled for Ink soft launch; enable later via factory owner. */
export const CUSTOM_SOLIDITY_HOOKS_ENABLED = false;

export const DEFAULT_LAUNCH_STATE: LaunchFormState = {
  name: "",
  ticker: "",
  description: "",
  twitter: "",
  telegram: "",
  website: "",
  imagePreview: null,
  hookMode: "master",
  customHookSource: "",
  customHookFileName: "",
  modules: {
    antiSnipe: true,
    antiSnipeDuration: 5,
    antiSnipeInitialTax: 98,
    backedFloor: true,
    floorAllocation: 10,
    antiMev: true,
    maxWallet: false,
    maxWalletBps: 200,
    maxTx: false,
    maxTxBps: 100,
    autoBurn: false,
    autoBurnPct: 20,
    lpDonate: false,
    lpDonatePct: 20,
    holderAirdrop: false,
    holderAirdropPct: 50,
    holderAirdropEpochSeconds: 15 * 60,
    buybackVesting: false,
    buybackVestingDurationDays: BUYBACK_VESTING_DEFAULT_DAYS,
    dynamicFees: false,
    dynamicFeeMinBps: BASE_FEE_BPS,
    dynamicFeeMaxBps: DYNAMIC_FEE_DEFAULT_MAX_BPS,
    dynamicFeeDepthSaturationBps: DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS,
    creatorShareToHook: false,
  },
  hookTaxBps: 0,
  devBuyMode: "supply",
  devBuySupplyPct: 0,
  devBuyEth: "",
  quoteAsset: "eth",
  markets: [{ id: "eth", bps: 10_000 }],
  floorQuoteIndex: 0,
};

export const DEFAULT_CLASSIC_LAUNCH_STATE: LaunchFormState = {
  ...DEFAULT_LAUNCH_STATE,
  hookTaxBps: 0,
  modules: {
    antiSnipe: false,
    antiSnipeDuration: 5,
    antiSnipeInitialTax: 98,
    backedFloor: false,
    floorAllocation: 10,
    antiMev: false,
    maxWallet: false,
    maxWalletBps: 200,
    maxTx: false,
    maxTxBps: 100,
    autoBurn: false,
    autoBurnPct: 20,
    lpDonate: false,
    lpDonatePct: 20,
    holderAirdrop: false,
    holderAirdropPct: 50,
    holderAirdropEpochSeconds: 15 * 60,
    buybackVesting: false,
    buybackVestingDurationDays: BUYBACK_VESTING_DEFAULT_DAYS,
    dynamicFees: false,
    dynamicFeeMinBps: BASE_FEE_BPS,
    dynamicFeeMaxBps: DYNAMIC_FEE_DEFAULT_MAX_BPS,
    dynamicFeeDepthSaturationBps: DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS,
    creatorShareToHook: false,
  },
};

/** Master wizard starts with no hooks — users opt in on each step. */
export const DEFAULT_MASTER_WIZARD_STATE: LaunchFormState = {
  ...DEFAULT_LAUNCH_STATE,
  hookTaxBps: 0,
  modules: {
    ...DEFAULT_CLASSIC_LAUNCH_STATE.modules,
  },
};

export const GITHUB_REPO_URL = "https://github.com/deadpouule/hookit";
export const TWITTER_URL = "https://x.com/hookitfun";

export const MOCK_METRICS: ProtocolMetrics = {
  totalVolume: 12_847_392,
  floorLockedEth: 284.7,
  totalPools: 142,
};

export const MOCK_POOLS: TokenPool[] = [
  {
    id: "1",
    name: "DebtReliefBot",
    ticker: "DRB",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    marketCap: 15_370_000,
    floorValue: 420_000,
    liquidity: 1_750_000,
    volume24h: 1_750_000,
    change24h: -3.22,
    earnings: 727_450,
    hooks: { antiSnipe: true, backedFloor: true, antiMev: false, customHook: false },
    address: "0x7987...24EE",
    creator: "0xb105c8e4f9a2d3c1b8e7f6a5d4c3b2a1e0f9e8d7c6",
    hookType: "Master",
    launchId: 9,
    launchedAt: 9,
  },
  {
    id: "2",
    name: "Horse",
    ticker: "HORSE",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 40%, #8b8b8b 100%)",
    marketCap: 1_120_000,
    floorValue: 92_400,
    liquidity: 445_000,
    volume24h: 312_000,
    change24h: 272,
    earnings: 89_200,
    hooks: { antiSnipe: false, backedFloor: true, antiMev: false, customHook: false },
    address: "0x3b2C...8e2c",
    creator: "0x3b2c8e2c1a0f9e8d7c6b5a4938271605f4e3d2c1",
    hookType: "Master",
    launchId: 8,
    launchedAt: 8,
  },
  {
    id: "3",
    name: "Void Runner",
    ticker: "VOID",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #1a0533 0%, #4c1d95 50%, #7c3aed 100%)",
    marketCap: 680_000,
    floorValue: 41_200,
    liquidity: 220_000,
    volume24h: 98_400,
    change24h: -8.4,
    earnings: 47_300,
    hooks: { antiSnipe: true, backedFloor: false, antiMev: true, customHook: true },
    address: "0x9d4e...3a1f",
    creator: "0x9d4e3a1f8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3",
    hookType: "Custom",
    launchId: 7,
    launchedAt: 7,
  },
  {
    id: "4",
    name: "Base Spark",
    ticker: "SPARK",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #001a66 0%, #0052ff 55%, #d4ff00 100%)",
    marketCap: 3_800_000,
    floorValue: 312_000,
    liquidity: 1_200_000,
    volume24h: 890_000,
    change24h: 56.1,
    earnings: 358_900,
    hooks: { antiSnipe: true, backedFloor: true, antiMev: true, customHook: false },
    address: "0x1a2b...9f0e",
    creator: "0x1a2b9f0e8d7c6b5a4938271605f4e3d2c1b0a9f8",
    hookType: "Master",
    launchId: 6,
    launchedAt: 6,
  },
  {
    id: "5",
    name: "Liquid Hook",
    ticker: "HOOK",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #0c4a6e 0%, #38bdf8 50%, #e0f2fe 100%)",
    marketCap: 920_000,
    floorValue: 78_500,
    liquidity: 380_000,
    volume24h: 156_000,
    change24h: 4.2,
    earnings: 90_275,
    hooks: { antiSnipe: false, backedFloor: true, antiMev: false, customHook: false },
    address: "0x5e73...3408",
    creator: "0x5e7334081a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    hookType: "Master",
    launchId: 5,
    launchedAt: 5,
  },
  {
    id: "6",
    name: "Snipe Shield",
    ticker: "SHLD",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #052e16 0%, #16a34a 50%, #bbf7d0 100%)",
    marketCap: 540_000,
    floorValue: 28_900,
    liquidity: 175_000,
    volume24h: 72_500,
    change24h: 18.7,
    earnings: 33_235,
    hooks: { antiSnipe: true, backedFloor: false, antiMev: true, customHook: false },
    address: "0x8b5b...d3b9",
    creator: "0x8b5bd3b91c2a3f4e5d6c7b8a9f0e1d2c3b4a5968",
    hookType: "Master",
    launchId: 4,
    launchedAt: 4,
  },
  {
    id: "7",
    name: "Ponstar",
    ticker: "STAR",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(180deg, #7dd3fc 0%, #38bdf8 40%, #ffffff 100%)",
    marketCap: 2_100_000,
    floorValue: 156_000,
    liquidity: 620_000,
    volume24h: 410_000,
    change24h: 22.1,
    earnings: 179_400,
    hooks: { antiSnipe: false, backedFloor: true, antiMev: false, customHook: false },
    address: "0xa1b2...c3d4",
    creator: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
    hookType: "Master",
    launchId: 3,
    launchedAt: 3,
  },
  {
    id: "8",
    name: "Meme Lord",
    ticker: "LORD",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #450a0a 0%, #dc2626 50%, #fbbf24 100%)",
    marketCap: 890_000,
    floorValue: 12_400,
    liquidity: 98_000,
    volume24h: 64_200,
    change24h: -3.2,
    earnings: 14_260,
    hooks: { antiSnipe: true, backedFloor: false, antiMev: false, customHook: true },
    address: "0xf00d...beef",
    creator: "0xf00dbeef1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    hookType: "Custom",
    launchId: 2,
    launchedAt: 2,
  },
  {
    id: "9",
    name: "Floor Ratchet",
    ticker: "RATCH",
    image: "",
    banner: "",
    bannerGradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #a1a1aa 100%)",
    marketCap: 1_450_000,
    floorValue: 198_000,
    liquidity: 520_000,
    volume24h: 287_000,
    change24h: 8.9,
    earnings: 227_700,
    hooks: { antiSnipe: false, backedFloor: true, antiMev: true, customHook: false },
    address: "0xdead...cafe",
    creator: "0xdeadcafe9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3",
    hookType: "Master",
    launchId: 1,
    launchedAt: 1,
  },
];

export const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/builder", label: "Builder" },
  { href: "/launch", label: "Create" },
  { href: "https://github.com/deadpouule/hookit", label: "GitHub", external: true },
] as const;
