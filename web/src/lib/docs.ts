export type DocsSlug =
  | "overview"
  | "architecture"
  | "hkt"
  | "launches"
  | "multi-pair"
  | "quotrons"
  | "trading"
  | "graduation"
  | "fees"
  | "creator-fees"
  | "hooks"
  | "anti-snipe"
  | "anti-mev"
  | "max-tx"
  | "max-wallet"
  | "floor"
  | "deepen-lps"
  | "auto-burn"
  | "buyback-vesting"
  | "holder-airdrop"
  | "creator-share"
  | "fixed-fees"
  | "dynamic-fees"
  | "math"
  | "analytics"
  | "integration"
  | "network"
  | "contracts"
  | "events"
  | "reading"
  | "pricing"
  | "risks"
  | "support"
  | "terms";

export interface DocsPageMeta {
  slug: DocsSlug;
  href: string;
  title: string;
  description: string;
  group: "Introduction" | "Protocol" | "Modules" | "Reference";
  keywords: string;
}

export const DOCS_PAGES: DocsPageMeta[] = [
  {
    slug: "overview",
    href: "#overview",
    title: "Overview",
    description: "Permissionless Uniswap v4 launchpad on Ink. Dual rail, no custody.",
    group: "Introduction",
    keywords: "hookit launchpad overview ink uniswap v4 master classic",
  },
  {
    slug: "architecture",
    href: "#architecture",
    title: "Architecture",
    description: "App, HookitSwapRouter, MasterLaunchHook, Uniswap v4 PoolManager, Ink.",
    group: "Introduction",
    keywords: "stack router hook poolmanager quotrons indexer",
  },
  {
    slug: "hkt",
    href: "#hkt",
    title: "$HKT",
    description: "Hold $HKT and every launch airdrops you a slice of its token.",
    group: "Introduction",
    keywords: "hkt holder drop flywheel tokenomics thesis keeper",
  },
  {
    slug: "launches",
    href: "#launches",
    title: "How launches work",
    description: "Six-step Master wizard and Classic bonding. Locked LP, 1B supply, 2.5% dev buy.",
    group: "Protocol",
    keywords: "launch factory bitmask locked lp wizard builder",
  },
  {
    slug: "multi-pair",
    href: "#multi-pair",
    title: "Multi-pair",
    description: "One token, up to five quote markets. Floor off. Arb keeper paused.",
    group: "Protocol",
    keywords: "launchmulti markets bps arb keeper",
  },
  {
    slug: "quotrons",
    href: "#quotrons",
    title: "Quotrons",
    description: "wStock launch pairs on Ink. USDG composite buys.",
    group: "Protocol",
    keywords: "quotrons wapple wnvidia usdg rwa",
  },
  {
    slug: "trading",
    href: "#trading",
    title: "Trading",
    description: "Hooked swaps through HookitSwapRouter. Composite quote legs.",
    group: "Protocol",
    keywords: "swap router slippage composite quotrons bonding",
  },
  {
    slug: "graduation",
    href: "#graduation",
    title: "Graduation",
    description: "Classic curve graduates at 4.2 ETH-equivalent into a v4 pool.",
    group: "Protocol",
    keywords: "bonding curve graduate 4.2 eth sweepquote",
  },
  {
    slug: "fees",
    href: "#fees",
    title: "Fees and flywheel",
    description: "1% base splits 60/10/30. Optional hook tax funds modules.",
    group: "Protocol",
    keywords: "fee 60 10 30 flywheel hook tax hkt buyback",
  },
  {
    slug: "creator-fees",
    href: "#creator-fees",
    title: "Creator fees",
    description: "FeeEscrow, BuybackVault, or hook pot. Classic sweepQuote.",
    group: "Protocol",
    keywords: "feescrow claim sweepquote creator",
  },
  {
    slug: "hooks",
    href: "#hooks",
    title: "Hook modules",
    description: "Protection, tokenomics, rewards, trading fees — including Deepen LPs.",
    group: "Protocol",
    keywords: "anti-snipe floor deepen-lps dynamic fees airdrop",
  },
  {
    slug: "anti-snipe",
    href: "#anti-snipe",
    title: "Anti-Snipe",
    description: "Buy-only decay tax at open. Default 98% over 5s.",
    group: "Modules",
    keywords: "anti-snipe decay tax launch window",
  },
  {
    slug: "anti-mev",
    href: "#anti-mev",
    title: "Anti-MEV",
    description: "One swap per origin per pool per block. SandwichBlocked.",
    group: "Modules",
    keywords: "anti-mev sandwich blocked origin",
  },
  {
    slug: "max-tx",
    href: "#max-tx",
    title: "Max Tx",
    description: "0.1%–2.5% of supply per swap, fee-inclusive.",
    group: "Modules",
    keywords: "max tx supply cap",
  },
  {
    slug: "max-wallet",
    href: "#max-wallet",
    title: "Max Wallet",
    description: "0.1%–2.5% of supply per address after a buy.",
    group: "Modules",
    keywords: "max wallet supply cap",
  },
  {
    slug: "floor",
    href: "#floor",
    title: "Backed Floor",
    description: "Every swap lifts the floor. More volume = higher floor. Single-pair only.",
    group: "Modules",
    keywords: "floor vault redeem ratchet premium",
  },
  {
    slug: "deepen-lps",
    href: "#deepen-lps",
    title: "Deepen LPs",
    description: "Hook-tax share minted back into launch LP range.",
    group: "Modules",
    keywords: "deepen lps pending liquidity",
  },
  {
    slug: "auto-burn",
    href: "#auto-burn",
    title: "Auto-Burn",
    description: "Hook pot buys the token and burns it after each swap.",
    group: "Modules",
    keywords: "auto-burn pending buyback dead",
  },
  {
    slug: "buyback-vesting",
    href: "#buyback-vesting",
    title: "Buyback Vesting",
    description: "Creator 60% of base vests on time or FDV.",
    group: "Modules",
    keywords: "buyback vesting escrow fdv cliff vestpacked",
  },
  {
    slug: "holder-airdrop",
    href: "#holder-airdrop",
    title: "Holder Airdrop",
    description: "Hook-pot quote paid pro-rata via ERC-6909 claims.",
    group: "Modules",
    keywords: "holder airdrop epoch quote vault claims",
  },
  {
    slug: "creator-share",
    href: "#creator-share",
    title: "Creator → Hook",
    description: "Creator 60% of the 1% joins the hook pot.",
    group: "Modules",
    keywords: "creator share to hook pot",
  },
  {
    slug: "fixed-fees",
    href: "#fixed-fees",
    title: "Fixed Fees",
    description: "Flat extra hook tax. Exclusive with Dynamic Fees.",
    group: "Modules",
    keywords: "fixed fees hook tax",
  },
  {
    slug: "dynamic-fees",
    href: "#dynamic-fees",
    title: "Dynamic Fees",
    description: "Hook tax ramps with in-range LP depth. No oracle.",
    group: "Modules",
    keywords: "dynamic fees depth saturation hook tax",
  },
  {
    slug: "math",
    href: "#math",
    title: "Formulas",
    description: "Snipe decay, dynamic depth fee, CPMM curve, $HKT drop, protocol 20/80.",
    group: "Modules",
    keywords: "formulas dynamic fee bonding k sqrtPriceX96",
  },
  {
    slug: "analytics",
    href: "#analytics",
    title: "Analytics",
    description: "/stats volume, protocol take, $HKT burn and holder drop.",
    group: "Reference",
    keywords: "stats protocol volume buyback",
  },
  {
    slug: "integration",
    href: "#integration",
    title: "Integration",
    description: "Indexer HTTP, events, and on-chain reads.",
    group: "Reference",
    keywords: "indexer events viem health candles",
  },
  {
    slug: "network",
    href: "#network",
    title: "Network",
    description: "Ink 57073 production. Base Sepolia for integration.",
    group: "Reference",
    keywords: "ink 57073 rpc usdg",
  },
  {
    slug: "contracts",
    href: "#contracts",
    title: "Contracts",
    description: "Live factory, router, claims redeemer, and Uniswap v4 core.",
    group: "Reference",
    keywords: "launchfactory hookitswaprouter v4claimsredeemer",
  },
  {
    slug: "events",
    href: "#events",
    title: "Onchain events",
    description: "TokenLaunched, multi-pair, vault, buyback, and Swap logs.",
    group: "Reference",
    keywords: "tokenlaunched swap dropped redeemed",
  },
  {
    slug: "reading",
    href: "#reading",
    title: "Reading state",
    description: "getLaunchPage, bitmask, vestPacked, metadataURI.",
    group: "Reference",
    keywords: "getLaunchPage bitmask vestpacked metadata",
  },
  {
    slug: "pricing",
    href: "#pricing",
    title: "Pricing",
    description: "sqrtPriceX96 spot, FloorVault.floorPriceX18, 30m TWAP.",
    group: "Reference",
    keywords: "sqrtPriceX96 floorPriceX18 twap",
  },
  {
    slug: "risks",
    href: "#risks",
    title: "Risks",
    description: "Unaudited software. Tokens can go to zero.",
    group: "Reference",
    keywords: "risk unaudited copycat liquidity",
  },
  {
    slug: "support",
    href: "#support",
    title: "Support",
    description: "GitHub issues. No SLA.",
    group: "Reference",
    keywords: "github support",
  },
  {
    slug: "terms",
    href: "#terms",
    title: "Terms",
    description: "Software only. See /terms and /privacy.",
    group: "Reference",
    keywords: "terms privacy hookit",
  },
];

export const DOCS_GROUPS = ["Introduction", "Protocol", "Modules", "Reference"] as const;
export const DOCS_SECTION_IDS = DOCS_PAGES.map((page) => page.slug);

export function getDocsPage(slug: string): DocsPageMeta | undefined {
  return DOCS_PAGES.find((page) => page.slug === slug);
}
