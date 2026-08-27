import type { PairingTokenId } from "./pairing-tokens";

export type HookMode = "master" | "custom";

export type ExploreCategory =
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
  dynamicFees: boolean;
  buybackVesting: boolean;
  autoBurn: boolean;
  lpDonate: boolean;
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
  creatorTaxBps: number;
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
    customHook: boolean;
  };
  address: string;
  quoteAsset?: string;
  hookType: "Master" | "Custom";
  bannerGradient: string;
  priceEth?: number;
  volume24h?: number;
  contractAddress?: string;
  poolId?: `0x${string}`;
  tokenIsCurrency0?: boolean;
}

export interface ProtocolMetrics {
  totalVolume: number;
  floorLockedEth: number;
  totalPools: number;
}
