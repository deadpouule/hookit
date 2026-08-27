import {
  BASE_FEE_BPS,
  CREATOR_SHARE_BPS,
  GITHUB_REPO_URL,
  GRADUATION_ETH,
  LAUNCH_FEE_ETH,
  PROTOCOL_SHARE_BPS,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import { getChainDeployment } from "@/lib/contracts/config";
import { getDefaultRpcUrl, getNetworkLabel, resolveHookitChainKey } from "@/lib/chains";

export type DocsSectionId =
  | "overview"
  | "launches"
  | "trading"
  | "graduation"
  | "fees"
  | "hooks"
  | "floor"
  | "integration"
  | "network"
  | "contracts"
  | "events"
  | "reading"
  | "pricing"
  | "risks"
  | "support"
  | "terms";

export type DocsBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; title?: string; items: string[] }
  | { type: "steps"; steps: { num: string; title: string; text: string }[] }
  | { type: "defs"; rows: { term: string; text: string }[] }
  | { type: "code"; title?: string; code: string }
  | { type: "contract"; label: string; address: string; note?: string }
  | { type: "divider"; label: string };

export type DocsSection = {
  id: DocsSectionId;
  title: string;
  group: "Introduction" | "Protocol" | "Reference";
  blocks: DocsBlock[];
};

const BASE_FEE_PCT = BASE_FEE_BPS / 100;
const CREATOR_FEE_PCT = CREATOR_SHARE_BPS / 100;
const PROTOCOL_FEE_PCT = PROTOCOL_SHARE_BPS / 100;
const dep = getChainDeployment();
const chainKey = resolveHookitChainKey();

export const DOCS_NAV: { group: string; items: { id: DocsSectionId; label: string }[] }[] = [
  {
    group: "Introduction",
    items: [{ id: "overview", label: "Overview" }],
  },
  {
    group: "Protocol",
    items: [
      { id: "launches", label: "How launches work" },
      { id: "trading", label: "Trading and pricing" },
      { id: "graduation", label: "Graduation" },
      { id: "fees", label: "Fees and flywheel" },
      { id: "hooks", label: "Launch modules" },
      { id: "floor", label: "Backed floor" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "integration", label: "Integration" },
      { id: "network", label: "Network" },
      { id: "contracts", label: "Contracts" },
      { id: "events", label: "Onchain events" },
      { id: "reading", label: "Reading token state" },
      { id: "pricing", label: "Pricing and floor" },
      { id: "risks", label: "Risk disclosures" },
      { id: "support", label: "Support" },
      { id: "terms", label: "Terms and attribution" },
    ],
  },
];

export function buildDocsSections(): DocsSection[] {
  const rpc = getDefaultRpcUrl();
  const network = getNetworkLabel();

  return [
    {
      id: "overview",
      title: "Overview",
      group: "Introduction",
      blocks: [
        {
          type: "p",
          text: `hook it is a launchpad: anyone can create a token and start trading it on ${network}, powered by Uniswap v4. You browse tokens on the marketplace, open a token page for charts and holders, and buy or sell directly from your wallet.`,
        },
        {
          type: "p",
          text: "hook it is only an interface. We never hold your ETH, tokens, or stablecoins. Every launch and every trade is a transaction you review and sign in your wallet.",
        },
        {
          type: "h3",
          text: "What you can do",
        },
        {
          type: "ul",
          items: [
            "Explore — browse all launches, filter by modules, and see live stats.",
            "Launch — create your own token in one or two wallet confirmations.",
            "Trade — swap on the token page with instant or Pro mode.",
            "Portfolio — see tokens you created or hold, linked to your connected wallet.",
          ],
        },
        {
          type: "h3",
          text: "Two paths in the app",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Classic (/launch/classic)",
              text: "Bonding curve first, then graduation to a Uniswap pool. Similar to pump.fun-style launches. You set an optional extra creator tax.",
            },
            {
              term: "Custom (/launch/custom)",
              text: "Master launch on-chain: token + pool + locked liquidity in one transaction. Pick optional modules (anti-snipe, floor, caps…) or paste your own hook code if you are a developer.",
            },
          ],
        },
        {
          type: "p",
          text: "Both paths mint 1 billion tokens with fixed supply. The launch fee is the same; only the trading setup differs.",
        },
        {
          type: "callout",
          title: "Before you trade or launch",
          items: [
            "Always check the token contract address — names and logos can be copied.",
            "Starting market cap on Master launches is about $" + TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US") + "; that does not mean the token is worth that forever.",
            "Most tokens are experimental. Price can drop to zero and liquidity can disappear.",
            "Nothing here is financial advice.",
          ],
        },
      ],
    },
    {
      id: "launches",
      title: "How launches work",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "Launching creates a new ERC-20 token and its trading setup on-chain. What happens depends on whether you pick Master or Classic.",
        },
        {
          type: "h3",
          text: "Step by step (creator)",
        },
        {
          type: "steps",
          steps: [
            {
              num: "01",
              title: "Connect your wallet",
              text: `Make sure you are on ${network} and have a little ETH for gas plus the launch fee (${LAUNCH_FEE_ETH} ETH).`,
            },
            {
              num: "02",
              title: "Fill in token info",
              text: "Name, ticker, description, image, and optional social links. This metadata is stored on-chain. Images can be pinned to IPFS when the server is configured.",
            },
            {
              num: "03",
              title: "Pick Classic or Custom",
              text: "Classic opens a bonding curve. Custom deploys a Master launch — modules, quote asset (ETH or stable), or your own hook code.",
            },
            {
              num: "04",
              title: "Sign the transaction",
              text: "Your wallet sends the launch. Master deploys token + pool + locked LP in one go. Classic opens the bonding curve. You can optionally buy tokens in the same flow (dev buy).",
            },
            {
              num: "05",
              title: "Token goes live",
              text: "Your token appears on Explore and gets its own page with chart, holders, and swap widget.",
            },
          ],
        },
        {
          type: "h3",
          text: "Custom launch (Master on-chain)",
        },
        {
          type: "ul",
          items: [
            "1 billion tokens are minted (fixed supply, 18 decimals).",
            `Starting price targets roughly $${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")} fully diluted market cap at launch (converted to ETH or your chosen quote using the chain price feed).`,
            "A Uniswap v4 pool is created and seeded with liquidity in a locked price range — creators cannot pull that LP.",
            "Trading starts immediately; buyers and sellers move the price like any AMM pool.",
            "Optional modules (see Modular hooks) add rules such as launch-window taxes or a backed floor.",
          ],
        },
        {
          type: "h3",
          text: "Classic launch — what actually happens",
        },
        {
          type: "ul",
          items: [
            "Same 1 billion supply, but 80% is sold on a bonding curve first; 20% is reserved for liquidity at graduation.",
            "Early buyers pay increasing prices as the curve fills. Sells are allowed on the curve with fees applied.",
            `When real quote collected hits ~${GRADUATION_ETH} ETH (or the stable equivalent), the token graduates automatically.`,
            "After graduation, remaining tokens and collected quote seed a full Uniswap v4 pool. Trading continues there.",
          ],
        },
        {
          type: "callout",
          title: "Launch protection (Master modules)",
          items: [
            "Anti-snipe — extra fee on buys right after launch that fades over minutes. Stops bots from buying everything at the opening price.",
            "Max wallet / max trade — caps how much one address can hold or swap per transaction when enabled.",
            "Custom hooks — third-party code; treat as unaudited unless you verified it yourself.",
          ],
        },
      ],
    },
    {
      id: "trading",
      title: "Trading and pricing",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "When you buy or sell on a token page, you swap against either the live Uniswap pool (Master or graduated Classic) or the bonding curve (Classic pre-graduation). The price shown is the current on-chain price — not a quote from hook it.",
        },
        {
          type: "h3",
          text: "What the numbers on screen mean",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Price",
              text: "How much quote (ETH or stable) one token costs right now. Updates every time someone trades.",
            },
            {
              term: "Market cap",
              text: "Price × total supply, shown in USD when an ETH/USD feed is available. It is a snapshot, not a guarantee you can sell that amount.",
            },
            {
              term: "Liquidity",
              text: "Roughly how much value sits in the pool near the current price (TVL in USD). Higher usually means smaller price jumps per trade — but thin pools still exist.",
            },
            {
              term: "24h volume",
              text: "How much was traded in the last day, from the indexer. Requires the indexer to be running and synced.",
            },
            {
              term: "Slippage",
              text: "Your tolerance: if the price moves more than this % before your transaction lands, it reverts instead of filling at a worse price.",
            },
            {
              term: "Price impact",
              text: "How much your specific trade size moves the pool price. Large buys on small pools = high impact.",
            },
          ],
        },
        {
          type: "h3",
          text: "How to trade",
        },
        {
          type: "ul",
          items: [
            "Connect wallet on the token page.",
            "Choose buy or sell and enter an amount.",
            "Instant mode — quick swap with default slippage.",
            "Pro mode — pick slippage, see estimated receive amount, optionally pay with ETH or a supported stable.",
            `Every swap pays a trading fee on the quote side (see Fees). Fees are taken in ETH/USDC/etc., never in the memecoin itself.`,
          ],
        },
        {
          type: "h3",
          text: "Limit and stop tabs (Pro mode)",
        },
        {
          type: "p",
          text: "These are price alerts in your browser, not real orders on the blockchain. You set a target price; when spot crosses it, you get a toast notification. You still need to place a market swap yourself. Alerts are stored locally — they do not work if you close the tab or use another device.",
        },
        {
          type: "callout",
          title: "Why use hook it routers?",
          items: [
            "Tokens use custom Uniswap v4 hooks (fee splits, floor, anti-snipe). Swapping through hook it keeps those rules applied correctly.",
            "Swapping on a generic DEX UI may bypass hook logic or fail if the pool uses a custom hook.",
          ],
        },
      ],
    },
    {
      id: "graduation",
      title: "Graduation",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "Graduation only applies to Classic launches. Master launches skip this — they have a pool from day one.",
        },
        {
          type: "h3",
          text: "The bonding phase",
        },
        {
          type: "p",
          text: "While a Classic token is on the curve, buys increase the price along a fixed formula. Part of each trade is kept as fees; the rest grows the quote reserve. The progress bar on the token page shows how close the launch is to graduating.",
        },
        {
          type: "h3",
          text: "When does it graduate?",
        },
        {
          type: "p",
          text: `Automatically when the curve collects about ${GRADUATION_ETH} ETH worth of real quote (or the same USD value if you launched against USDC/USDG). No button to press — the next trade that crosses the threshold triggers graduation in the same flow.`,
        },
        {
          type: "h3",
          text: "What changes after graduation",
        },
        {
          type: "ul",
          items: [
            "Trading moves from the bonding contract to a normal Uniswap v4 pool.",
            "Leftover tokens (20% of supply) plus collected quote become locked liquidity in that pool.",
            "Fees switch to the graduated fee hook — same base 1% + optional creator tax as Master.",
            "The token page chart and swap widget automatically use the new pool.",
          ],
        },
        {
          type: "callout",
          title: "Graduation is not a seal of approval",
          items: [
            "It only means the curve hit its funding target.",
            "It does not mean the team is legit, the token will hold value, or you can exit easily.",
            "Many graduated tokens still have low liquidity or collapse after hype fades.",
          ],
        },
      ],
    },
    {
      id: "fees",
      title: "Fees and flywheel",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "Every buy and sell pays a trading fee. Fees are always taken from the quote asset (ETH, USDC, USDG, etc.) — you never pay fees in the launched token.",
        },
        {
          type: "h3",
          text: "Standard trading fee",
        },
        {
          type: "defs",
          rows: [
            {
              term: `Base fee (${BASE_FEE_PCT}%)`,
              text: "Applied on every swap. Split between creator and protocol.",
            },
            {
              term: `Creator share (${CREATOR_FEE_PCT}% of base)`,
              text: "Goes to the launch creator. They can claim accumulated fees from the token page when the contract has a balance.",
            },
            {
              term: `Protocol share (${PROTOCOL_FEE_PCT}% of base)`,
              text: "Goes to hook it treasury / protocol contracts. Part may fund operations; part may buy back HOOK when that path is enabled on-chain.",
            },
            {
              term: "Creator tax (optional)",
              text: "Extra fee the creator adds at launch (Master module or Classic slider). Base + creator tax cannot exceed 10% total.",
            },
            {
              term: "Anti-snipe tax (optional)",
              text: "Temporary extra fee on buys right after a Master launch. Fades to zero over the launch window — not part of the permanent fee.",
            },
          ],
        },
        {
          type: "h3",
          text: "Launch fee",
        },
        {
          type: "p",
          text: `Creating a token costs ${LAUNCH_FEE_ETH} ETH (plus gas) paid to the factory contract. This is separate from trading fees and is not refundable.`,
        },
        {
          type: "h3",
          text: "Where fees go when modules are on",
        },
        {
          type: "p",
          text: "On Master launches, the creator can route part of the fee pool to optional sinks: backed floor vault, auto-burn (tokens bought and burned), or LP donations (extra liquidity). Percentages are set at launch and cannot be changed later.",
        },
        {
          type: "h3",
          text: "Stats page honesty",
        },
        {
          type: "p",
          text: "Protocol stats show live launch count, TVL, and indexer volume where available. Buyback and burn history only appear when those events are actually indexed on-chain — we do not fabricate transaction lists.",
        },
      ],
    },
    {
      id: "hooks",
      title: "Launch modules",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "Master launches can enable optional modules — rules baked into the pool at creation. You pick them in the launch form or Builder. Once set, they cannot be turned off.",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Anti-snipe",
              text: "High tax on buys immediately after launch that decreases over time (you choose duration and starting tax). Protects against bots sniping the opening price.",
            },
            {
              term: "Backed floor",
              text: "A slice of trading fees goes into a vault. Holders can later redeem tokens for quote at the floor price. The floor only goes up, never down.",
            },
            {
              term: "Anti-MEV cooldown",
              text: "Short delay between trades from the same wallet to reduce same-block bot spam.",
            },
            {
              term: "Max trade size",
              text: "Limits how large a single swap can be (% of total supply).",
            },
            {
              term: "Max wallet",
              text: "Limits how many tokens one address can hold (% of total supply).",
            },
            {
              term: "Auto-burn",
              text: "Uses part of fees to buy and burn tokens, reducing supply over time.",
            },
            {
              term: "LP donate",
              text: "Uses part of fees to add liquidity to the pool.",
            },
            {
              term: "Creator tax",
              text: "Permanent extra fee on swaps paid to the creator, on top of the base 1%.",
            },
          ],
        },
        {
          type: "p",
          text: "Explore shows which modules each token uses and how many launches picked each one — useful to see what is popular, not what is safe.",
        },
        {
          type: "h3",
          text: "Custom hooks (advanced)",
        },
        {
          type: "p",
          text: "Developers can paste Solidity hook code. hook it compiles it, finds a valid deploy address (Uniswap v4 requires specific address flags), and deploys from your wallet. Custom hooks are not reviewed by hook it. Read the code or treat the token as high risk.",
        },
      ],
    },
    {
      id: "floor",
      title: "Backed floor",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "If a Master launch enables Backed floor, a portion of each trade's fees (set at launch, e.g. 10%) is sent to a FloorVault — a separate contract that holds quote (ETH or stable) as collateral for that token only.",
        },
        {
          type: "h3",
          text: "Floor price",
        },
        {
          type: "p",
          text: "Floor price = vault balance ÷ token total supply. It tells you the minimum quote you would receive if you redeemed tokens at the floor. When new fees deposit into the vault, the floor can rise. It never falls — redemptions use math that protects remaining holders.",
        },
        {
          type: "h3",
          text: "Redeeming",
        },
        {
          type: "p",
          text: "Token holders can redeem on the token page: you send tokens to the vault, they are burned, and you receive quote at the current floor price. You do not need to sell on the open market. Redeeming large amounts lowers the vault balance and can affect the floor for everyone left.",
        },
        {
          type: "h3",
          text: "Important limits",
        },
        {
          type: "ul",
          items: [
            "The floor is only as strong as the fees flowing in. Low volume = slow or no floor growth.",
            "Floor value is not the same as market price — market can trade above or below floor.",
            "If the vault is empty, redemption returns nothing useful.",
            "Classic launches do not use backed floor unless you graduate and use a custom setup — it is a Master module.",
          ],
        },
      ],
    },
    {
      id: "integration",
      title: "For developers and integrators",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Everything hook it displays can be rebuilt from public blockchain data. The app uses factory contracts, Uniswap v4 pools, and an optional indexer for charts and history.",
        },
        {
          type: "ul",
          items: [
            "Launches — read TokenLaunched events from LaunchFactory (Master) or BondingLaunchFactory (Classic).",
            "Trades — read Swap events from the Uniswap v4 PoolManager for each pool.",
            "Live price — read pool state via StateView (sqrtPriceX96) or simulate swaps via the V4 Quoter.",
            "Metadata — each LaunchToken exposes metadataURI (JSON with name, image, links).",
            "Indexer — optional HTTP API for candles, recent trades, and holder lists (see INDEXER_URL in env).",
          ],
        },
        {
          type: "p",
          text: "On-chain events are the source of truth. The indexer is a convenience layer and may lag or be offline on testnet.",
        },
      ],
    },
    {
      id: "network",
      title: "Network",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: `hook it deploys on ${network} today. Production targets Ink (chain ID 57073); integration and testing use Base Sepolia (84532). Your wallet must match the chain the app is configured for.`,
        },
        {
          type: "defs",
          rows: [
            { term: "Active network", text: network },
            { term: "Chain ID", text: String(dep.chainId) },
            { term: "Gas token", text: "ETH" },
            { term: "Public RPC", text: rpc },
            { term: "Token supply", text: "1,000,000,000 (1 billion) on both Master and Classic" },
            { term: "Starting mcap target (Master)", text: `~$${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")} at launch` },
            { term: "Graduation target (Classic)", text: `~${GRADUATION_ETH} ETH equivalent` },
            { term: "Quote assets", text: chainKey === "ink" ? "ETH, USDG, and supported Quotrons" : "ETH and USDC on Base Sepolia" },
          ],
        },
      ],
    },
    {
      id: "contracts",
      title: "Contracts",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Hook-specific addresses (LaunchFactory, BondingLaunchFactory, swap router) come from your environment variables. Below are the shared Uniswap v4 core contracts on the active chain — the same infrastructure every v4 pool uses.",
        },
        {
          type: "contract",
          label: "PoolManager",
          address: dep.poolManager,
          note: "All v4 pools live here",
        },
        {
          type: "contract",
          label: "StateView",
          address: dep.stateView,
          note: "Read pool prices and liquidity",
        },
        {
          type: "contract",
          label: "V4 Quoter",
          address: dep.v4Quoter,
          note: "Simulate swap outputs off-chain",
        },
        {
          type: "contract",
          label: "Universal Router",
          address: dep.universalRouter,
        },
        {
          type: "contract",
          label: "Stable quote",
          address: dep.stableQuote,
          note: chainKey === "ink" ? "USDG on Ink" : "USDC on Base Sepolia",
        },
        {
          type: "contract",
          label: "ETH/USD feed",
          address: dep.ethUsdFeed,
          note: "Used for USD display and launch pricing",
        },
        ...(chainKey === "baseSepolia"
          ? [
              {
                type: "contract" as const,
                label: "PoolSwapTest (dev swaps)",
                address: dep.poolSwapTest,
              },
            ]
          : []),
      ],
    },
    {
      id: "events",
      title: "Onchain events",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "To build your own explorer or bot, index these events from the deployment block forward. Wide getLogs ranges on public RPCs often timeout — paginate in chunks.",
        },
        {
          type: "ul",
          items: [
            "LaunchFactory.TokenLaunched — new Master (or custom hook) launch.",
            "BondingLaunchFactory.TokenLaunched / Bought / Sold / Graduated — Classic lifecycle.",
            "PoolManager.Swap — every pool trade after graduation or on Master.",
          ],
        },
        {
          type: "code",
          title: "Example: list Master launches (viem)",
          code: `import { createPublicClient, http, parseAbiItem } from "viem";

const client = createPublicClient({
  chain: { id: ${dep.chainId}, name: "${network}", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["${rpc}"] } } },
  transport: http(),
});

const launches = await client.getLogs({
  address: process.env.NEXT_PUBLIC_LAUNCH_FACTORY,
  event: parseAbiItem(
    "event TokenLaunched(uint256 indexed launchId, address indexed token, address indexed creator, bytes32 poolId, address hooks, bool customHook)",
  ),
  fromBlock: "earliest",
  toBlock: "latest",
});`,
        },
      ],
    },
    {
      id: "reading",
      title: "Reading token state",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Each launch gets a numeric launchId on the factory. From there you can load the token address, pool, creator, module bitmask, and quote asset — all on-chain.",
        },
        {
          type: "code",
          title: "Paginate launches from the factory",
          code: `import { parseAbi } from "viem";

const factoryAbi = parseAbi([
  "function getLaunchPage(uint256 startId, uint256 limit) view returns ((address token, address creator, address hooks, bool customHook, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity)[], uint256[] bitmasks, uint64[] timestamps, uint256 total)",
  "function launchQuote(uint256 launchId) view returns (address)",
  "function launchedAt(uint256 launchId) view returns (uint64)",
]);

const [page, bitmasks, timestamps, total] = await client.readContract({
  address: factory,
  abi: factoryAbi,
  functionName: "getLaunchPage",
  args: [1n, 50n],
});`,
        },
        {
          type: "p",
          text: "The bitmask unpacks into human-readable modules (anti-snipe, floor, etc.). Token metadata lives in metadataURI on the ERC-20. Charts and holder rankings need the indexer unless you compute them yourself from Transfer events.",
        },
      ],
    },
    {
      id: "pricing",
      title: "Pricing and floor",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Spot price on Master or graduated pools comes from the pool's sqrtPriceX96 (Uniswap v4 math). Classic bonding price comes from the curve reserves. USD values multiply by the chain ETH/USD oracle when available.",
        },
        {
          type: "code",
          title: "Read pool price from StateView",
          code: `const [sqrtPriceX96] = await client.readContract({
  address: stateView,
  abi: parseAbi(["function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"]),
  functionName: "getSlot0",
  args: [poolId],
});

const ratio = Number(sqrtPriceX96) / 2 ** 96;
const priceQuotePerToken = tokenIsCurrency0 ? ratio * ratio : 1 / (ratio * ratio);`,
        },
        {
          type: "p",
          text: "Backed floor: call FloorVault.floorPriceX18(token) for the redeem price. UI liquidity is TVL in USD (both sides of the pool), which is easier to interpret than raw Uniswap liquidity units.",
        },
      ],
    },
    {
      id: "risks",
      title: "Risk disclosures",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Tokens on hook it are created by users, not vetted by us. Treat every launch as high risk until you have done your own research.",
        },
        {
          type: "ul",
          items: [
            "You can lose all money you spend — prices are volatile and many tokens go to zero.",
            "Copycat names, logos, and social links are common. Verify the contract address every time.",
            "Smart contracts may contain bugs. hook it and Uniswap v4 code are not fully audited for all configurations.",
            "Custom hooks can include malicious logic (honeypots, hidden taxes, blocked sells).",
            "Low liquidity means you may not be able to sell at the price shown.",
            "RPC, wallet, and indexer outages can break the UI or show stale data.",
            "Limit/stop alerts are not guaranteed — they depend on your browser staying open.",
            "Testnet tokens have no real value; mainnet launches involve real funds.",
          ],
        },
        {
          type: "p",
          text: "hook it provides software tools only. We do not endorse any token, creator, or module combination.",
        },
      ],
    },
    {
      id: "support",
      title: "Support",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "hook it is early-stage software. The fastest way to report bugs or ask integration questions is GitHub Issues on the public repository.",
        },
        {
          type: "p",
          text: `Repository: ${GITHUB_REPO_URL}`,
        },
        {
          type: "p",
          text: "Include your chain, token address, transaction hash, and wallet type when reporting swap or launch failures — it speeds up debugging.",
        },
      ],
    },
    {
      id: "terms",
      title: "Terms and attribution",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Onchain data is public and free to read. You are responsible for how you use it. hook it is provided as is, without warranties.",
        },
        {
          type: "ul",
          items: [
            "Write the name in lowercase: hook it.",
            "Do not imply partnership, endorsement, or audited status without written agreement.",
            "Do not present third-party services as operated by hook it.",
            "Availability of interfaces and public infrastructure is not guaranteed.",
          ],
        },
      ],
    },
  ];
}
