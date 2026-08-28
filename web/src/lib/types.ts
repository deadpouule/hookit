import type { PairingTokenId } from "./pairing-tokens";

export type HookMode = "master" | "custom";

export type ExploreCategory =
  | "top"
  | "trending"
  | "newest"
  | "custom"
  | "all"
  | "backed-floor"
  | "anti-snipe"
  | "custom-hooks"
  | "top-gainers";

export interface LaunchModules {
  antiSnipe: boolean;
  antiSnipeDuration: number;
  antiSnipeInitialTax: number;
  backedFloor: boolean;
  floorAllocation: number;
  antiMev: boolean;
  maxWallet: boolean;
  maxWalletBps: number;
  maxTx: boolean;
  maxTxBps: number;
  /** UI toggle — not packed into Master bitmask yet. */
  dynamicFees?: boolean;
  /** UI toggle — not packed into Master bitmask yet. */
  buybackVesting?: boolean;
  autoBurn: boolean;
  autoBurnPct: number;
  lpDonate: boolean;
  lpDonatePct: number;
  /** Quote-fee share accrued for periodic holder airdrops (Master). */
  holderAirdrop: boolean;
  /** Percent of hook pot routed to HolderAirdropVault (1–50). */
  holderAirdropPct: number;
  /** Route creator's 70% of the base fee into the hook pot (modules) instead of escrow. */
  creatorShareToHook: boolean;
}

export interface LaunchFormState {
  name: string;
  ticker: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  imagePreview: string | null;
  hookMode: "master" | "custom";
  /** Solidity source uploaded/pasted for custom hooks — deployed automatically at launch. */
  customHookSource: string;
  customHookFileName: string;
  modules: LaunchModules;
  hookTaxBps: number;
  devBuyEth: string;
  quoteAsset: PairingTokenId;
}

export interface TokenPool {
  id: string;
  name: string;
  ticker: string;
  image: string;
  banner: string;
  marketCap: number;
  floorValue: number;
  liquidity: number;
  change24h: number;
  hooks: {
    antiSnipe: boolean;
    backedFloor: boolean;
    antiMev: boolean;
    maxTx?: boolean;
    maxWallet?: boolean;
    autoBurn?: boolean;
    lpDonate?: boolean;
    holderAirdrop?: boolean;
    creatorShareToHook?: boolean;
    customHook: boolean;
  };
  address: string;
  quoteAsset?: string;
  hookType: "Master" | "Custom" | "Classic";
  bannerGradient: string;
  priceEth?: number;
  volume24h?: number;
  contractAddress?: string;
  poolId?: `0x${string}`;
  tokenIsCurrency0?: boolean;
  creator?: `0x${string}`;
  earnings?: number;
  launchId?: number;
  launchedAt?: number;
  hooksAddress?: `0x${string}`;
  quoteAddress?: `0x${string}`;
  tickSpacing?: number;
  lpFee?: number;
  /** Locked position range (Master / graduated Classic). */
  tickLower?: number;
  tickUpper?: number;
  /** Raw Uniswap L (uint128) — not USD. */
  liquidityRaw?: string;
  priceSeries?: number[];
  trades24h?: number;
  /** Master atomic pool vs Classic bonding curve. */
  rail?: "master" | "classic";
  bondingPhase?: number;
  tokensSold?: string;
  graduationQuote?: string;
  realQuote?: string;
}

export interface ProtocolMetrics {
  totalVolume: number;
  floorLockedEth: number;
  totalPools: number;
}
