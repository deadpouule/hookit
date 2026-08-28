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
    title: "Master hook modules",
    description: "MasterLaunchHook modules: anti-snipe, floor, auto-burn, airdrop, and custom hooks.",
    group: "Protocol",
    keywords: "master launch hook anti-snipe anti-mev floor auto-burn holder airdrop bitmask",
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

export type DocsBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] };

const DOCS_BODY: Record<DocsSlug, DocsBlock[]> = {
  overview: [
    {
      type: "p",
      text: "Hookit is a permissionless Uniswap v4 launchpad. Creators launch tokens with modular Master hooks or a Classic bonding curve; traders buy and sell through Hookit routers so hook accounting stays correct.",
    },
    { type: "h3", text: "Dual rail" },
    {
      type: "ul",
      items: [
        "Master — atomic token + v4 pool + locked LP with bitmask modules (anti-snipe, floor, MEV, burns…).",
        "Classic — bonding curve until graduation, then a graduated fee hook pool.",
        "Custom — bring your own Solidity hook; Hookit mines CREATE2 flags and deploys from your wallet.",
      ],
    },
  ],
  launches: [
    {
      type: "p",
      text: "A launch is one wallet transaction (plus optional hook deploy). Supply is fixed (typically 1B), LP is locked in-range, and metadata ships as a data URI (image preferably IPFS).",
    },
    { type: "h3", text: "What you need" },
    {
      type: "ul",
      items: [
        "Connected wallet on the Hookit chain with ETH for the launch fee + gas.",
        "NEXT_PUBLIC_LAUNCH_FACTORY (Master) or NEXT_PUBLIC_BONDING_FACTORY (Classic).",
        "Optional PINATA_JWT for IPFS image pinning.",
      ],
    },
  ],
  trading: [
    {
      type: "p",
      text: "Spot price comes from pool slot0 / bonding virtual reserves. Market swaps use the v4 quoter for expected out and slippage bounds. Instant mode is a one-click amount; Pro mode shows route, pay-with, and quotes.",
    },
    { type: "h3", text: "Limit & stop" },
    {
      type: "p",
      text: "Limit and stop are client-side price alerts stored in your browser. They toast when spot crosses your target — they are not on-chain resting orders.",
    },
  ],
  floor: [
    {
      type: "p",
      text: "Backed Floor routes a share of quote fees into FloorVault. The ratchet floor never decreases. Redeem tokens against the vault from the token page creator/holder actions.",
    },
  ],
  fees: [
    {
      type: "p",
      text: "Fees are quote-only. Protocol share can be routed toward ops / buyback once the fee escrow and HOOK path are live. Stats show live launch TVL and indexer volume; buyback fills appear when those events are indexed.",
    },
  ],
  hooks: [
    {
      type: "p",
      text: "MasterLaunchHook packs modules into a uint256 bitmask (anti-snipe, backed floor, anti-MEV, max tx/wallet, auto-burn, LP donate, hook tax). Custom hooks must satisfy Uniswap v4 flag bits mined into the CREATE2 address.",
    },
  ],
  network: [
    {
      type: "p",
      text: "Production targets Ink (57073). Integration uses Base Sepolia (84532). Set NEXT_PUBLIC_HOOKIT_CHAIN and matching RPC + factory addresses.",
    },
  ],
  contracts: [
    {
      type: "p",
      text: "Core addresses come from env: LaunchFactory, BondingLaunchFactory, HookitSwapRouter, plus Uniswap v4 PoolManager / Quoter for the active chain. See web/.env.example.",
    },
  ],
  events: [
    {
      type: "p",
      text: "The house indexer watches TokenLaunched, bonding Graduated, and PoolManager Swap logs to power candles, trades, holders, and StatusBar health.",
    },
  ],
  reading: [
    {
      type: "p",
      text: "Use getLaunchPage / launches(id) / launchedAt / launchQuote on the factory, configs(poolId) on MasterLaunchHook, and ERC-20 metadataURI for images and socials.",
    },
  ],
  pricing: [
    {
      type: "p",
      text: "Market cap = price × supply with ETH/USD from the protocol feed when available. Liquidity is TVL in USD (reserves), not raw Uniswap L. Floor price is FloorVault.floorPriceX18.",
    },
  ],
  risks: [
    {
      type: "ul",
      items: [
        "Unaudited software — expect bugs.",
        "Tokens can go to zero; custom hooks are unverified by default.",
        "Testnet / early mainnet liquidity is thin; slippage can be severe.",
        "Client limit/stop alerts require the browser tab open (or a future worker).",
      ],
    },
  ],
  support: [
    {
      type: "p",
      text: "Open issues on GitHub. No guaranteed support SLA while the protocol is early.",
    },
  ],
  terms: [
    {
      type: "p",
      text: "Style the brand as “hook it” in lowercase. Referencing Hookit does not imply partnership, endorsement, or audited status.",
    },
  ],
};

export function getDocsBody(slug: DocsSlug): DocsBlock[] {
  return DOCS_BODY[slug] ?? [{ type: "p", text: "Section coming soon." }];
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
