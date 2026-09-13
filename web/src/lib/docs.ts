export type DocsSlug =
  | "overview"
  | "architecture"
  | "launches"
  | "trading"
  | "graduation"
  | "fees"
  | "hooks"
  | "floor"
  | "math"
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
  group: "Introduction" | "Protocol" | "Reference";
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
    slug: "launches",
    href: "#launches",
    title: "How launches work",
    description: "Master wizard and Classic bonding. Locked LP, 1B supply.",
    group: "Protocol",
    keywords: "launch factory bitmask locked lp wizard",
  },
  {
    slug: "trading",
    href: "#trading",
    title: "Trading",
    description: "Hooked swaps through HookitSwapRouter. Quote-only fees.",
    group: "Protocol",
    keywords: "swap router slippage composite quotrons",
  },
  {
    slug: "graduation",
    href: "#graduation",
    title: "Graduation",
    description: "Classic curve graduates at 4.2 ETH-equivalent into a v4 pool.",
    group: "Protocol",
    keywords: "bonding curve graduate 4.2 eth",
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
    slug: "hooks",
    href: "#hooks",
    title: "Hook modules",
    description: "Protection, tokenomics, rewards, trading fees — including Deepen LPs.",
    group: "Protocol",
    keywords: "anti-snipe floor deepen-lps dynamic fees airdrop",
  },
  {
    slug: "floor",
    href: "#floor",
    title: "Backed Floor",
    description: "Ratcheting redeemable floor: P_floor = V_quote / S_circ.",
    group: "Protocol",
    keywords: "floor vault redeem ratchet premium",
  },
  {
    slug: "math",
    href: "#math",
    title: "Formulas",
    description: "Snipe decay, dynamic depth fee, CPMM curve, $HKT drop, protocol 20/80.",
    group: "Protocol",
    keywords: "formulas dynamic fee bonding k sqrtPriceX96",
  },
  {
    slug: "integration",
    href: "#integration",
    title: "Integration",
    description: "Events, indexer HTTP, and on-chain reads.",
    group: "Reference",
    keywords: "indexer events viem",
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
    description: "Live factory, router, and Uniswap v4 core addresses.",
    group: "Reference",
    keywords: "launchfactory hookitswaprouter poolmanager",
  },
  {
    slug: "events",
    href: "#events",
    title: "Onchain events",
    description: "TokenLaunched, bonding lifecycle, PoolManager Swap.",
    group: "Reference",
    keywords: "tokenlaunched swap logs",
  },
  {
    slug: "reading",
    href: "#reading",
    title: "Reading state",
    description: "getLaunchPage, bitmasks, metadataURI.",
    group: "Reference",
    keywords: "getLaunchPage bitmask metadata",
  },
  {
    slug: "pricing",
    href: "#pricing",
    title: "Pricing",
    description: "sqrtPriceX96 spot and FloorVault.floorPriceX18.",
    group: "Reference",
    keywords: "sqrtPriceX96 floorPriceX18 tvl",
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

export const DOCS_GROUPS = ["Introduction", "Protocol", "Reference"] as const;
export const DOCS_SECTION_IDS = DOCS_PAGES.map((page) => page.slug);

export function getDocsPage(slug: string): DocsPageMeta | undefined {
  return DOCS_PAGES.find((page) => page.slug === slug);
}
