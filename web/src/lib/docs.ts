export type DocsSlug =
  | "overview"
  | "launches"
  | "trading"
  | "floor"
  | "fees"
  | "hooks"
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
    description: "Launch and trade tokens on Uniswap v4. Wallet-signed, no custody.",
    group: "Introduction",
    keywords: "hookit launchpad overview base sepolia uniswap v4",
  },
  {
    slug: "launches",
    href: "#launches",
    title: "Launch mechanism",
    description: "Atomic token + pool + locked liquidity in one transaction.",
    group: "Protocol",
    keywords: "create launch factory supply lock lp unilateral range",
  },
  {
    slug: "trading",
    href: "#trading",
    title: "Trading and pricing",
    description: "Live pool price, market cap, slippage, and quote-only fees.",
    group: "Protocol",
    keywords: "swap buy sell price impact slippage liquidity",
  },
  {
    slug: "floor",
    href: "#floor",
    title: "Backed floor",
    description: "Ratcheting floor price backed by quote in FloorVault.",
    group: "Protocol",
    keywords: "floor vault redeem ratchet p_floor circulating",
  },
  {
    slug: "fees",
    href: "#fees",
    title: "Fees and flywheel",
    description: "1% quote-only fees, 70/30 split, protocol revenue routing.",
    group: "Protocol",
    keywords: "fee creator protocol ops buyback escrow tax snipe",
  },
  {
    slug: "hooks",
    href: "#hooks",
    title: "Modular hooks",
    description: "MasterLaunchHook modules and unverified custom hooks.",
    group: "Protocol",
    keywords: "anti-snipe anti-mev max wallet custom hook bitmask",
  },
  {
    slug: "network",
    href: "#network",
    title: "Network",
    description: "Base Sepolia parameters for launches and trades.",
    group: "Reference",
    keywords: "chain id 84532 rpc sepolia tick spacing supply",
  },
  {
    slug: "contracts",
    href: "#contracts",
    title: "Contracts",
    description: "Uniswap v4 and Hookit contract addresses.",
    group: "Reference",
    keywords: "pool manager factory hook vault addresses",
  },
  {
    slug: "events",
    href: "#events",
    title: "Onchain events",
    description: "Index TokenLaunched and PoolManager Swap logs.",
    group: "Reference",
    keywords: "events logs indexer viem tokenlaunched swap",
  },
  {
    slug: "reading",
    href: "#reading",
    title: "Reading token state",
    description: "Read launches, bitmasks, and token metadata onchain.",
    group: "Reference",
    keywords: "launches configs metadataURI creator bitmask",
  },
  {
    slug: "pricing",
    href: "#pricing",
    title: "Pricing and floor",
    description: "Derive spot price from slot0 and floor from the vault.",
    group: "Reference",
    keywords: "sqrtPriceX96 slot0 state view floorPriceX18",
  },
  {
    slug: "risks",
    href: "#risks",
    title: "Risk disclosures",
    description: "Unaudited testnet software. Tokens can go to zero.",
    group: "Reference",
    keywords: "risk unaudited testnet volatility copycat",
  },
  {
    slug: "support",
    href: "#support",
    title: "Support",
    description: "GitHub is the source of truth while Hookit is on testnet.",
    group: "Reference",
    keywords: "github support issues testnet",
  },
  {
    slug: "terms",
    href: "#terms",
    title: "Terms and attribution",
    description: "How to reference hook it. No partnership implied.",
    group: "Reference",
    keywords: "terms attribution lowercase unaudited",
  },
];

export const DOCS_GROUPS = ["Introduction", "Protocol", "Reference"] as const;

export const DOCS_SECTION_IDS = DOCS_PAGES.map((page) => page.slug);

export function getDocsPage(slug: string): DocsPageMeta | undefined {
  return DOCS_PAGES.find((page) => page.slug === slug);
}

export const UNISWAP_V4_BASE_SEPOLIA = {
  poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
  positionManager: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
  stateView: "0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4",
  quoter: "0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa",
  universalRouter: "0x492E6456D9528771018DeB9E87ef7750EF184104",
  poolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9",
} as const;

export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_CHAIN_ID = 84532;
