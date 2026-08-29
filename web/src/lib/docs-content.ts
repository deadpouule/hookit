import {
  BASE_FEE_BPS,
  CREATOR_SHARE_BPS,
  GITHUB_REPO_URL,
  GRADUATION_ETH,
  LAUNCH_FEE_ETH,
  MAX_HOOK_TAX_BPS,
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
      { id: "hooks", label: "Master hook modules" },
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
              text: "Bonding curve first, then graduation to a Uniswap pool. Similar to pump.fun-style launches. Steady fee is the base 1% only (70% creator / 30% protocol).",
            },
            {
              term: "Custom (/launch/custom)",
              text: "Master launch: token + Uniswap v4 pool + locked LP in one tx via MasterLaunchHook. Optional hook tax funds modules (anti-snipe, floor, auto-burn, airdrop…) or paste your own hook code.",
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
          type: "p",
          text: "In the app this is /launch/custom. On-chain it uses LaunchFactory + MasterLaunchHook — a single Uniswap v4 hook shared by every Master pool.",
        },
        {
          type: "ul",
          items: [
            "1 billion tokens are minted (fixed supply, 18 decimals).",
            `Starting price targets roughly $${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")} fully diluted market cap at launch (converted to ETH or your chosen quote using the chain price feed / Quotrons pool price for wStocks).`,
            "A Uniswap v4 pool is created with LP fee tier 0%. Trading fees are charged by the hook instead (quote-only).",
            "Liquidity is seeded in a locked price range — the creator cannot remove that LP (anti-rug).",
            "Trading starts in the same transaction. Buyers and sellers move price like any AMM.",
            "You pick optional modules at launch (anti-snipe, floor, airdrop, burns…). They are packed into a bitmask and cannot be changed later.",
            "Quote asset can be ETH, USDG, or a Quotrons wrapped xStock (e.g. wNVDAx) when those markets are seeded on Ink.",
          ],
        },
        {
          type: "h3",
          text: "What MasterLaunchHook does on every swap",
        },
        {
          type: "steps",
          steps: [
            {
              num: "01",
              title: "Before swap",
              text: "Applies anti-MEV / max-tx / max-wallet checks when enabled. Computes the quote-notional fee (base 1% + hook tax + temporary anti-snipe on buys).",
            },
            {
              num: "02",
              title: "Take fee in quote",
              text: "The hook pulls the fee from the quote leg only — never from the memecoin amount as a token tax.",
            },
            {
              num: "03",
              title: "Route the fee pool",
              text: "Hook tax (if any) funds Master modules (floor, auto-burn, LP donate, airdrop); leftover hook tax goes to protocol. Base 1% (+ anti-snipe share) always splits 70% creator / 30% protocol — modules never touch that split.",
            },
            {
              num: "04",
              title: "After swap",
              text: "Runs pending auto-burn (buy + burn launch token) and LP donate if those modules left a balance to process.",
            },
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
            "After graduation, remaining tokens and collected quote seed a full Uniswap v4 pool with GraduatedFeeHook (same quote-only fee idea as Master).",
          ],
        },
        {
          type: "callout",
          title: "Master vs Classic in one line",
          items: [
            "Master = pool + locked LP + modular hook from block one.",
            "Classic = bonding curve first, then graduate into a simpler fee hook pool.",
            "Custom Solidity hooks are an advanced Master path — unaudited by default.",
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
            "Fees switch to the graduated fee hook — same base 1% quote-only fee, 70/30 creator/protocol (no hook tax on Classic).",
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
          text: "Every buy and sell pays a trading fee. Fees are always taken from the quote asset (ETH, USDC, USDG, wStock, etc.) — you never pay fees in the launched memecoin itself.",
        },
        {
          type: "h3",
          text: "Steady fee (every Master / graduated swap)",
        },
        {
          type: "defs",
          rows: [
            {
              term: `Base fee (${BASE_FEE_PCT}%)`,
              text: `Always on. Always splits ${CREATOR_FEE_PCT}% creator / ${PROTOCOL_FEE_PCT}% protocol. Creators can optionally route their ${CREATOR_FEE_PCT}% into the hook pot (“Creator → hook”).`,
            },
            {
              term: "Hook tax (optional, Master)",
              text: `Extra permanent fee (0–${MAX_HOOK_TAX_BPS / 100}% so base + tax ≤ 10%). Replaces the old creator tax: this cut funds Master modules (floor / burn / donate / airdrop). Unallocated → protocol.`,
            },
            {
              term: "Anti-snipe (optional, Master)",
              text: "Temporary extra fee on buys only, decaying to 0 over the launch window. Stacked on top of base + hook tax at open; its share follows the base 70/30 split.",
            },
          ],
        },
        {
          type: "h3",
          text: "How MasterLaunchHook splits the fee",
        },
        {
          type: "steps",
          steps: [
            {
              num: "01",
              title: "Peel hook tax",
              text: "If hook tax is set, that fraction of the fee pot goes into the hook pot for modules (leftover → protocol).",
            },
            {
              num: "02",
              title: "Optional: creator → hook",
              text: "If enabled, the creator’s 70% of the base also joins the hook pot instead of FeeEscrow. Protocol still keeps its 30% of the base.",
            },
            {
              num: "03",
              title: "Module cuts",
              text: "Of the hook pot (hook tax ± creator share), optional % go to floor, auto-burn, LP donate, and/or holder airdrop. Together ≤ 100%. Needs hook tax and/or creator→hook when any sink is on.",
            },
            {
              num: "04",
              title: "Base → creator / protocol",
              text: `Unless creator→hook is on, the base (+ anti-snipe) portion splits ${CREATOR_FEE_PCT}% creator / ${PROTOCOL_FEE_PCT}% protocol as usual.`,
            },
          ],
        },
        {
          type: "ul",
          items: [
            "Creator share (70% of base only) → FeeEscrow (claim on the token page), or BuybackVault if buyback-vesting is on, or HKIT buyback pot for the protocol native token.",
            "Protocol share → ProtocolRevenueDistributor: 20% ops / 80% flywheel, plus any unallocated hook tax.",
            "Classic launches: base 1% only (no hook tax / Master modules).",
            "wStock protocol fees can be converted to USDG via Quotrons pools before buyback routing.",
          ],
        },
        {
          type: "h3",
          text: "Example",
        },
        {
          type: "p",
          text: `Trade pays 1% base + 2% hook tax. Creator sets auto-burn 50% and floor 50% of the hook tax. Then 2% of the trade funds those sinks 50/50. The 1% base still splits ${CREATOR_FEE_PCT}/${PROTOCOL_FEE_PCT} creator/protocol.`,
        },
        {
          type: "h3",
          text: "Launch fee",
        },
        {
          type: "p",
          text: `Creating a token costs ${LAUNCH_FEE_ETH} ETH (plus gas) paid to the factory. Separate from trading fees; not refundable.`,
        },
        {
          type: "callout",
          title: "Remember",
          items: [
            "Pool LP fee tier is 0% — the hook charges instead.",
            "Hook tax is for the hook modules — not an extra creator take.",
            "Module % are of the hook-tax pot. Base fee stays a clean 70/30 for the creator.",
            "Percentages are fixed at launch and cannot be edited later.",
          ],
        },
        {
          type: "h3",
          text: "Stats page honesty",
        },
        {
          type: "p",
          text: "Protocol stats show live launch count, TVL, and indexer volume where available. Buyback and burn history only appear when those events are actually indexed — we do not fabricate lists.",
        },
      ],
    },
    {
      id: "hooks",
      title: "Master hook modules",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "MasterLaunchHook is the shared Uniswap v4 hook for every Custom/Master launch. Modules are optional rules packed into a uint256 bitmask at creation. You pick them in Launch Custom or Builder. Once the token is live, the bitmask cannot change.",
        },
        {
          type: "callout",
          title: "Important limits",
          items: [
            "Floor + auto-burn + LP donate + holder airdrop shares of the hook-tax pot cannot exceed 100%.",
            "Auto-burn, LP donate, and holder airdrop are each capped at 50% of that pot.",
            "Any fee sink requires hook tax > 0.",
            "Base fee (1%) + hook tax cannot exceed 10%.",
            "Anti-snipe only affects opening buys and fades out — it is not a permanent tax.",
            "Classic launches do not use these Master modules (base 1% only).",
          ],
        },
        {
          type: "h3",
          text: "Anti-snipe",
        },
        {
          type: "p",
          text: "Adds a high extra fee on buys right after launch. You set duration (seconds) and initial tax %. The tax decays linearly to zero over that window. Goal: make same-block snipes and instant dumps expensive for bots.",
        },
        {
          type: "h3",
          text: "Anti-MEV cooldown",
        },
        {
          type: "p",
          text: "One swap per wallet origin (tx.origin) per pool per block. A second swap from the same origin in the same block reverts. Reduces classic sandwich legs; not a private mempool.",
        },
        {
          type: "h3",
          text: "Max trade / max wallet",
        },
        {
          type: "p",
          text: "Max trade caps how large a single swap can be as a % of total supply. Max wallet caps how many tokens one address can hold after a buy. Both are optional and set at launch.",
        },
        {
          type: "h3",
          text: "Hook tax",
        },
        {
          type: "p",
          text: "Permanent extra quote fee on every swap. That slice funds Master modules (floor, auto-burn, LP donate, holder airdrop). Unallocated hook tax goes to the protocol. The creator’s take stays the 70% of the separate 1% base fee.",
        },
        {
          type: "h3",
          text: "Backed floor",
        },
        {
          type: "p",
          text: "Routes a % of the hook-tax pot into FloorVault as quote collateral. Holders can redeem launch tokens for quote at the floor price. The floor ratchets up and never decreases. See the Backed floor section for redeem details.",
        },
        {
          type: "h3",
          text: "Auto-burn",
        },
        {
          type: "p",
          text: "Routes a % of the hook-tax pot to buy the launched token from its own pool, then burns those tokens (LaunchToken.burn). The quote is spent; the memecoin supply shrinks. If the nested buy fails, the cut falls back to the floor vault.",
        },
        {
          type: "h3",
          text: "LP donate",
        },
        {
          type: "p",
          text: "Routes a % of the hook-tax pot as a Uniswap v4 donate into the pool (extra quote for in-range LPs). If the pool has no in-range liquidity yet, or donate fails, the cut falls back to the floor vault.",
        },
        {
          type: "h3",
          text: "Holder airdrop",
        },
        {
          type: "p",
          text: "Routes a % of the hook pot into HolderAirdropVault (still in quote — ETH, USDG, or wStock). Fees accumulate there. Every 15 minutes, once the window is open, a swap on the token can push the pot pro-rata to holders.",
        },
        {
          type: "ul",
          items: [
            "Pro-rata uses each holder’s balance of the launched token.",
            "System addresses (pool, hook, vaults) are excluded automatically.",
            "The holder list must cover all circulating balances or the call reverts (keeps the airdrop fair).",
            "Token page shows pending pot and countdown when the module is on.",
            "No dedicated keeper bot — the Hookit swap path supplies the holder set from the indexer when the epoch is ready.",
          ],
        },
        {
          type: "h3",
          text: "Buyback vesting (optional)",
        },
        {
          type: "p",
          text: "When enabled, the creator’s escrowed fee share (70% of base) goes to BuybackVault and vests linearly over the duration you pick (7 days to 5 years). Claim unlocks gradually on the token page.",
        },
        {
          type: "h3",
          text: "Custom hooks (advanced)",
        },
        {
          type: "p",
          text: "Instead of MasterLaunchHook modules, developers can paste their own Uniswap v4 hook Solidity. hook it compiles it, mines a CREATE2 address with the required permission flags, and deploys from your wallet. Custom hooks are not reviewed by hook it — read the code or treat the token as high risk.",
        },
        {
          type: "p",
          text: "Explore lists which modules each token uses and live usage counts — popularity is not a safety signal.",
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
          text: "Backed floor is a MasterLaunchHook module. A percentage of each swap’s hook-tax pot (set at launch) is deposited into FloorVault for that token only.",
        },
        {
          type: "h3",
          text: "Floor price",
        },
        {
          type: "p",
          text: "Floor price = vault quote balance ÷ token total supply. It is the redeem rate: how much quote you get per token if you redeem through the vault. New fee deposits can raise the floor. Redemptions use rounding that never lets the floor decrease for remaining holders.",
        },
        {
          type: "h3",
          text: "Redeeming",
        },
        {
          type: "p",
          text: "On the token page (when the module is on and the vault has reserves), holders send launch tokens to the vault. Tokens are burned; you receive quote at the current floor. This is separate from selling on the open market. Redeeming large amounts lowers vault reserves for everyone left.",
        },
        {
          type: "h3",
          text: "Floor vs market price",
        },
        {
          type: "ul",
          items: [
            "Market price can trade above or below the floor.",
            "Low volume → slow floor growth.",
            "Empty vault → redeem is useless until fees refill it.",
            "Failed auto-burn / LP donate cuts can also land in the floor vault as fallback.",
            "Classic launches do not include backed floor unless you use a custom setup after graduation.",
          ],
        },
        {
          type: "callout",
          title: "Known limitation",
          items: [
            "Floor fills help when spot is already at/near the floor path the hook implements — it is not a guarantee that every market sell is caught at floor across all tick moves.",
            "Always verify vault balance and token address before relying on floor as an exit.",
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
