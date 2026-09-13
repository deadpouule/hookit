import {
  BASE_FEE_BPS,
  CREATOR_SHARE_BPS,
  CUSTOM_SOLIDITY_HOOKS_ENABLED,
  DEFAULT_LAUNCH_ETH_USD,
  GITHUB_REPO_URL,
  GRADUATION_ETH,
  HKT_HOLDER_SHARE_BPS,
  LAUNCH_FEE_ETH,
  MAX_HOOK_TAX_BPS,
  PROTOCOL_SHARE_BPS,
  TARGET_LAUNCH_MCAP_USD,
} from "@/lib/constants";
import {
  getBondingFactoryAddress,
  getChainDeployment,
  getClaimsRedeemerAddress,
  getHkitBuybackAddress,
  getHookitSwapRouterAddress,
  getLaunchFactoryAddress,
  getLaunchFactoryQueryAddress,
  getNativeTokenAddress,
  getProtocolDistributorAddress,
} from "@/lib/contracts/config";
import { getDefaultRpcUrl, getNetworkLabel, resolveHookitChainKey } from "@/lib/chains";
import type { BrowseHookId } from "@/lib/master-hooks";
import { MAX_DEV_BUY_BPS } from "@/lib/protocol-limits";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

export type DocsSectionId =
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

export type DocsDiagramId =
  | "rails"
  | "stack"
  | "flywheel"
  | "fee-split"
  | "swap-lifecycle"
  | "classic-curve"
  | "floor-loop"
  | "hkt-loop";

export type DocsFormulaLine = {
  name: string;
  math: string;
  note?: string;
};

export type DocsBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; title?: string; items: string[] }
  | { type: "steps"; steps: { num: string; title: string; text: string }[] }
  | { type: "defs"; rows: { term: string; text: string }[] }
  | { type: "code"; title?: string; code: string }
  | { type: "contract"; label: string; address: string; note?: string }
  | { type: "divider"; label: string }
  | { type: "diagram"; id: DocsDiagramId }
  | { type: "hooks" }
  | { type: "formulas"; title?: string; items: DocsFormulaLine[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hook-title"; hookId: BrowseHookId };

export type DocsSection = {
  id: DocsSectionId;
  title: string;
  hookId?: BrowseHookId;
  group: "Introduction" | "Protocol" | "Modules" | "Reference";
  blocks: DocsBlock[];
};

const BASE_FEE_PCT = BASE_FEE_BPS / 100;
const CREATOR_FEE_PCT = CREATOR_SHARE_BPS / 100;
const HKT_HOLDER_FEE_PCT = HKT_HOLDER_SHARE_BPS / 100;
const PROTOCOL_FEE_PCT = PROTOCOL_SHARE_BPS / 100;
const dep = getChainDeployment();
const chainKey = resolveHookitChainKey();

export const DOCS_NAV: { group: string; items: { id: DocsSectionId; label: string }[] }[] = [
  {
    group: "Introduction",
    items: [
      { id: "overview", label: "Overview" },
      { id: "architecture", label: "Architecture" },
      { id: "hkt", label: "$HKT" },
    ],
  },
  {
    group: "Protocol",
    items: [
      { id: "launches", label: "How launches work" },
      { id: "multi-pair", label: "Multi-pair" },
      { id: "quotrons", label: "Quotrons" },
      { id: "trading", label: "Trading" },
      { id: "graduation", label: "Graduation" },
      { id: "fees", label: "Fees and flywheel" },
      { id: "creator-fees", label: "Creator fees" },
      { id: "hooks", label: "Hook modules" },
    ],
  },
  {
    group: "Modules",
    items: [
      { id: "anti-snipe", label: "Anti-Snipe" },
      { id: "anti-mev", label: "Anti-MEV" },
      { id: "max-tx", label: "Max Tx" },
      { id: "max-wallet", label: "Max Wallet" },
      { id: "floor", label: "Backed Floor" },
      { id: "deepen-lps", label: "Deepen LPs" },
      { id: "auto-burn", label: "Auto-Burn" },
      { id: "buyback-vesting", label: "Buyback Vesting" },
      { id: "holder-airdrop", label: "Holder Airdrop" },
      { id: "creator-share", label: "Creator → Hook" },
      { id: "fixed-fees", label: "Fixed Fees" },
      { id: "dynamic-fees", label: "Dynamic Fees" },
      { id: "math", label: "Formulas" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "analytics", label: "Analytics" },
      { id: "integration", label: "Integration" },
      { id: "network", label: "Network" },
      { id: "contracts", label: "Contracts" },
      { id: "events", label: "Onchain events" },
      { id: "reading", label: "Reading state" },
      { id: "pricing", label: "Pricing" },
      { id: "risks", label: "Risks" },
      { id: "support", label: "Support" },
      { id: "terms", label: "Terms" },
    ],
  },
];

function addr(value: string | undefined, fallback = "not configured"): string {
  return value ?? fallback;
}

export function buildDocsSections(): DocsSection[] {
  const rpc = getDefaultRpcUrl();
  const network = getNetworkLabel();
  const factory = getLaunchFactoryAddress();
  const factoryQuery = getLaunchFactoryQueryAddress();
  const bonding = getBondingFactoryAddress();
  const router = getHookitSwapRouterAddress();
  const distributor = getProtocolDistributorAddress();
  const buyback = getHkitBuybackAddress();
  const native = getNativeTokenAddress();
  const claims = getClaimsRedeemerAddress();

  return [
    {
      id: "overview",
      title: "Overview",
      group: "Introduction",
      blocks: [
        {
          type: "p",
          text: `hookit is a permissionless Uniswap v4 launchpad on ${network}. Anyone can create a token, lock liquidity, and start trading from a wallet. The site never holds ETH, tokens, or keys.`,
        },
        {
          type: "p",
          text: "Two rails. Master opens a v4 pool with MasterLaunchHook in the same transaction. Classic sells on a bonding curve first, then graduates into a GraduatedFeeHook pool. Both mint 1 billion tokens. Both take fees in quote only.",
        },
        {
          type: "diagram",
          id: "rails",
        },
        {
          type: "h3",
          text: "What you can do",
        },
        {
          type: "ul",
          items: [
            "Explore. Browse launches. Filter by hook (All → Protection → Tokenomics → Rewards → Trading Fees), RWA / Quotrons pair, or multi-pair. OG vs copycat ticker badges.",
            "Hooks. Marketplace of modules with live-use counts.",
            "Launch. Master wizard (token & pair → protection → tokenomics → trading fees → fee split → review) or Classic bonding. /builder is the same modules as a draft, then deep-links to launch.",
            "Trade. Market swap on the token page through HookitSwapRouter so hook rules stay applied.",
            "Analytics. /stats — volume, protocol revenue, $HKT buyback/burn, holder-drop estimates.",
          ],
        },
        {
          type: "callout",
          title: "Before you trade or launch",
          items: [
            "Verify the token contract. Names and logos are copied constantly.",
            `Master start FDV is about $${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")}. That is a starting print, not a valuation.`,
            "Most tokens go to zero. Liquidity can vanish. Nothing here is advice.",
          ],
        },
      ],
    },
    {
      id: "architecture",
      title: "Architecture",
      group: "Introduction",
      blocks: [
        {
          type: "p",
          text: "The app is a wallet interface over Uniswap v4. Fees, floors, burns, and airdrops live in the hook — not in a backend that can change the rules after launch.",
        },
        {
          type: "diagram",
          id: "stack",
        },
        {
          type: "h3",
          text: "What is immutable",
        },
        {
          type: "ul",
          items: [
            "Module bitmask, hook tax, and fee-split percents are packed at launch. They cannot be edited later.",
            "Master launch LP in the seeded tick range cannot be removed.",
            "Classic LP after graduation sits in LiquidityLocker with no withdraw.",
            "New protocol versions ship as new factory addresses. Old pools keep the bytecode they launched with.",
          ],
        },
        {
          type: "h3",
          text: "What the site adds",
        },
        {
          type: "ul",
          items: [
            "House indexer for candles, trades, and holders (not The Graph).",
            "Defined.fi deep-link for an external chart when you want a second tape.",
            "Quotrons wStock quotes (wAAPLx, wNVDAx, …) as launch pairs on Ink. See Quotrons.",
            "Optional multi-pair markets on one token (1–5 quotes). Arb keeper is deployed paused until the next factory.",
          ],
        },
        {
          type: "h3",
          text: "What the site does not have",
        },
        {
          type: "ul",
          items: [
            "No custody wallet and no on-site portfolio page. Created / held tokens show on Explore and the token desk from the connected address.",
            "No resting on-chain limit book. Pro-mode alerts are browser toasts.",
          ],
        },
      ],
    },
    {
      id: "hkt",
      title: "$HKT",
      group: "Introduction",
      blocks: [
        {
          type: "p",
          text: `$HKT is the protocol token. Hold it and you are exposed to every token that trades on hookit — not as a promise, as an on-chain split of the 1% base fee.`,
        },
        {
          type: "diagram",
          id: "hkt-loop",
        },
        {
          type: "h3",
          text: "The thesis",
        },
        {
          type: "p",
          text: `Every Master and graduated Classic swap pays a 1% quote fee. ${HKT_HOLDER_FEE_PCT}% of that 1% (0.10% of the trade) buys the launched memecoin — the ticker on that pool — and HktHolderDropVault epoch-pushes those tokens to live $HKT holders, pro-rata.`,
        },
        {
          type: "ul",
          items: [
            "You do not receive $HKT from this flow. You receive the other tokens.",
            "Hold 1 $HKT and you get a slice of every launch that prints volume.",
            "Hold more $HKT and your slice of every drop is larger.",
            "Weights are live balances, not a launch-day snapshot.",
            "LP, factory, and protocol sinks are excluded so they do not eat the drop.",
          ],
        },
        {
          type: "h3",
          text: "Tokenomics",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Role",
              text: "Fair-launched native token of the pad (Ink may still show HOOKTEST / HTST on an early stack).",
            },
            {
              term: "Holder cut",
              text: `${HKT_HOLDER_FEE_PCT}% of every 1% base fee, on every hooked pool. Always on. Not a module you toggle.`,
            },
            {
              term: "Buyback",
              text: `80% of the protocol’s ${PROTOCOL_FEE_PCT}% (24 bps of volume) routes to native-token buyback. ETH stays ETH. wStock → USDG on Quotrons first.`,
            },
            {
              term: "Payout",
              text: "Batched each epoch (default 15 minutes, 48 holders per push). Never paid inside the swap itself.",
            },
          ],
        },
        {
          type: "formulas",
          items: [
            {
              name: "drop",
              math: "V · 1% · 10%",
              note: "Quote volume of a pool × base fee × holder share. Spent on that pool’s token.",
            },
            {
              name: "share_i",
              math: "bal_i($HKT) / Σ bal($HKT)",
              note: "After exclusions. Same weight applies to every launch token in the vault.",
            },
          ],
        },
        {
          type: "h3",
          text: "Not the Holder Airdrop module",
        },
        {
          type: "table",
          headers: ["", "$HKT drop (always on)", "Holder Airdrop (optional module)"],
          rows: [
            ["Who gets paid", "Live $HKT holders", "Holders of that launched token"],
            ["What they get", "The launched token", "Quote (ETH / USDG / wStock)"],
            ["Funded by", "10% of the 1% base", "A % of the hook-tax pot"],
            ["Toggle", "Cannot turn off", "Packed at launch"],
          ],
        },
        {
          type: "h3",
          text: "How the drop actually fires",
        },
        {
          type: "ul",
          items: [
            "The hook credits HktHolderDropVault on each swap (0.10% of quote, spent on that pool’s token).",
            "tryPush runs on a later swap once the epoch is ready. Max 48 $HKT holders per batch.",
            "Live $HKT (HTST on the early Ink stack) does not auto-list holders on transfer. A keeper syncs balances from Transfer logs / the indexer, then calls syncHolders + tryPush.",
            "LP, factory, vault, and protocol sinks are excluded so they do not eat the drop.",
            "Protocol 80% buyback is separate: ProtocolRevenueDistributor → HkitBuyback.execute, which buys $HKT and burns it. Not inside the swap.",
          ],
        },
        {
          type: "callout",
          title: "Risk",
          items: [
            "Most launched tokens go to zero. A bag of airdropped memecoins can be worth nothing.",
            "Thin $HKT float or excluded sinks changing later will change your share.",
            "If the holder-sync keeper lags, the on-chain weight list can be stale until the next sync.",
            "This is not a yield promise and not financial advice.",
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
          text: "A launch is one (or two) wallet transactions. What you pick — Master or Classic — decides whether a pool exists from block 0 or after the curve fills.",
        },
        {
          type: "h3",
          text: "Creator flow",
        },
        {
          type: "steps",
          steps: [
            {
              num: "01",
              title: "Connect",
              text: `Use ${network}. You need gas plus the ${LAUNCH_FEE_ETH} ETH launch fee.`,
            },
            {
              num: "02",
              title: "Token & pair",
              text: "Name, ticker, image, links, quote (ETH, USDG, or a Quotrons wStock). Optional extra markets. Metadata URI is on-chain; images pin via /api/ipfs/upload + /api/ipfs/metadata.",
            },
            {
              num: "03",
              title: "Protection",
              text: "Anti-MEV, Anti-Snipe, Max Tx, Max Wallet.",
            },
            {
              num: "04",
              title: "Tokenomics",
              text: "Holder Airdrop, Auto-Burn, Backed Floor, Buyback Vesting, Deepen LPs.",
            },
            {
              num: "05",
              title: "Trading fees + split",
              text: "Dynamic Fees or Fixed Fees, optional Creator → Hook, then the hook-pot 100% split.",
            },
            {
              num: "06",
              title: "Review & launch",
              text: "Master deploys token + pool + locked LP. Classic opens the curve. Optional same-tx dev buy, capped at 2.5% of supply.",
            },
          ],
        },
        {
          type: "h3",
          text: "Master (Launch Studio)",
        },
        {
          type: "p",
          text: "Six wizard steps: Token & pair → Protection → Tokenomics → Trading fees → Fee split → Review & launch. /builder is the same module draft without the pair step, then deep-links here. On-chain this is LaunchFactory + MasterLaunchHook.",
        },
        {
          type: "ul",
          items: [
            "1,000,000,000 tokens, 18 decimals, fixed supply.",
            `Start price targets ~$${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")} FDV in the chosen quote (ETH/USD TWAP seed $${DEFAULT_LAUNCH_ETH_USD.toLocaleString("en-US")}).`,
            "Uniswap v4 pool fee tier is 0%. Tick spacing 60. The hook charges instead, quote-only.",
            "LP is minted one-sided from the launch tick toward the usable range and locked. The creator cannot pull that LP.",
            "Trading is live in the same transaction.",
            "Optional modules pack into a uint256 bitmask. FDV vest plans pack separately as vestPacked. Both frozen after launch.",
            `Dev buy: same-tx, max ${MAX_DEV_BUY_BPS / 100}% of supply, as % of supply or a fixed quote amount.`,
          ],
        },
        {
          type: "diagram",
          id: "swap-lifecycle",
        },
        {
          type: "h3",
          text: "Classic",
        },
        {
          type: "ul",
          items: [
            "Same 1B supply. 80% sells on the curve; 20% is reserved for graduation LP.",
            `Curve graduates at ~${GRADUATION_ETH} ETH (or USDG / wStock equivalent).`,
            "After graduation, leftover tokens + collected quote seed a full-range v4 pool.",
            "GraduatedFeeHook keeps the same 1% quote-only base. No Master hook tax.",
          ],
        },
        {
          type: "callout",
          title: "Custom Solidity hooks vs Builder",
          items: [
            CUSTOM_SOLIDITY_HOOKS_ENABLED
              ? "You can paste your own v4 hook. hookit mines CREATE2 flags and deploys from your wallet. Unreviewed."
              : "Custom Solidity hooks are off for the Ink soft launch. The UI and factory allowlist stay closed until an audit.",
            "/builder composes the same Master modules. It is not a custom Solidity hook.",
          ],
        },
      ],
    },
    {
      id: "multi-pair",
      title: "Multi-pair",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "One token, up to five quote markets, launched in a single LaunchFactory.launchMulti. Each market is its own Uniswap v4 pool with the same MasterLaunchHook bitmask. Supply is split by the bps you set (must sum to 10_000).",
        },
        {
          type: "ul",
          items: [
            "1–5 markets. Typical: ETH + USDG + one or more Quotrons wStocks.",
            "Each market has its own poolId, tick range, and liquidity. The token page has a market switcher.",
            "Explore shows a multi-pair badge. Indexer fields: marketCount, markets[].",
            "Backed Floor is rejected in multi (BackedFloorNotAllowedInMulti). The wizard hides the floor card when you add a second market.",
            "Gas scales: ~2.8M base + ~950k per extra market.",
          ],
        },
        {
          type: "h3",
          text: "Arb keeper",
        },
        {
          type: "p",
          text: "MultiPairArbExecutor can buy the cheap USD leg and sell the rich one in one unlock. Defaults: 10% min deviation, max clip 0.50% of supply. The live Ink deploy is paused (maxClipUsdX18 = 0). Current MasterLaunchHook bytecode cannot take the arb path in place — that waits on a new factory.",
        },
      ],
    },
    {
      id: "quotrons",
      title: "Quotrons",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "On Ink you can pair a launch against wrapped equities from Quotrons (wAAPLx, wNVDAx, …) or USDG. Spot USD for FDV and graduation prefers the live Quotrons pool sqrtPriceX96; a seeded usdPriceX18 is fallback.",
        },
        {
          type: "table",
          headers: ["Ticker", "Name"],
          rows: INK_QUOTRON_STOCKS.map((stock) => [stock.symbol, stock.name]),
        },
        {
          type: "ul",
          items: [
            "wStock-quoted pools: the buy panel is USDG-only. HookitSwapRouter.swapExactInComposite bridges USDG → wStock on an allowed Quotrons pool, then swaps the hooked launch pool.",
            "Sells can composite the other way: token → wStock → USDG.",
            "Protocol wStock fees rail to USDG via ProtocolRevenueDistributor + FeeEthRail before ops / buyback.",
            "Quotrons hook 0x8bb4516059F9149Bc3b89018Fc7537f1F14a30cc. Bridge hooks must pass QuotronBridge.isAllowedBridgeHook.",
          ],
        },
      ],
    },
    {
      id: "trading",
      title: "Trading",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "Buys and sells hit the live Uniswap pool (Master or graduated Classic) or the bonding curve (Classic pre-graduation). The price on screen is the on-chain spot — not a hookit quote.",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Price",
              text: "Quote per token from sqrtPriceX96 (pool) or virtual reserves (curve).",
            },
            {
              term: "Market cap / FDV",
              text: "Price × 1B supply, in USD via the ETH/USD TWAP or the Quotrons wStock/USDG pool.",
            },
            {
              term: "Liquidity",
              text: "TVL in USD near spot. Thin books still move a lot per trade.",
            },
            {
              term: "Slippage",
              text: "If spot moves more than this % before inclusion, the swap reverts.",
            },
            {
              term: "Price impact",
              text: "How far this size walks the curve or the book.",
            },
          ],
        },
        {
          type: "h3",
          text: "Why the hookit router",
        },
        {
          type: "p",
          text: "Master and graduated pools need HookitSwapRouter so fee take, floor fills, burns, and airdrop pushes run. A generic DEX UI can skip hook accounting or revert.",
        },
        {
          type: "ul",
          items: [
            "swapExactIn — single hooked pool, quote already in the pool currency.",
            "swapExactInComposite — bridge leg (Quotrons / ETH↔USDG) then hooked launch leg, one unlock.",
            "swapExactInCompositeSell — token → quote → stable.",
            "wStock pools: pay USDG. ETH-quoted pools take ETH.",
          ],
        },
        {
          type: "h3",
          text: "Classic pre-graduation",
        },
        {
          type: "p",
          text: "Trades hit BondingLaunchFactory.buy / sell on the virtual CPMM, not the v4 router. The token page shows realQuote / graduationQuote. After graduation, use HookitSwapRouter on the GraduatedFeeHook pool (1% base only, no modules).",
        },
        {
          type: "h3",
          text: "Charts",
        },
        {
          type: "p",
          text: "Primary tape is house indexer candles (mcap-based, 5m default, 1m available). Fallback is GeckoTerminal OHLCV. Defined.fi is a deep-link second tape, not the in-app chart.",
        },
        {
          type: "callout",
          title: "Limit and stop",
          items: [
            "Pro-mode limit/stop tabs are browser alerts, not resting on-chain orders.",
            "They toast when spot crosses the target. You still sign a market swap.",
            "Alerts live in local storage. Close the tab and they do not fire.",
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
          text: "Classic only. Master already has a pool.",
        },
        {
          type: "diagram",
          id: "classic-curve",
        },
        {
          type: "p",
          text: `The next trade that pushes collected quote through ~${GRADUATION_ETH} ETH-equivalent graduates in the same flow. No button.`,
        },
        {
          type: "ul",
          items: [
            "Trading moves from BondingLaunchFactory to a Uniswap v4 pool.",
            "20% of supply + collected quote become locked full-range LP.",
            `Fees stay the 1% base, split ${CREATOR_FEE_PCT}% / ${HKT_HOLDER_FEE_PCT}% / ${PROTOCOL_FEE_PCT}% creator / $HKT / protocol.`,
            "Graduation is a funding threshold, not a quality stamp.",
            "Creator fees after graduation sit on GraduatedFeeHook.pendingCreatorTax. sweepQuote(poolId) moves them into FeeEscrow, then claim.",
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
          text: "Every swap pays a quote-only fee (ETH, USDG, wStock, …). You never pay the fee in the launched memecoin.",
        },
        {
          type: "diagram",
          id: "flywheel",
        },
        {
          type: "diagram",
          id: "fee-split",
        },
        {
          type: "h3",
          text: "The three fee layers",
        },
        {
          type: "defs",
          rows: [
            {
              term: `Base (${BASE_FEE_PCT}%)`,
              text: `Always on. Always ${CREATOR_FEE_PCT}% creator / ${HKT_HOLDER_FEE_PCT}% $HKT / ${PROTOCOL_FEE_PCT}% protocol.`,
            },
            {
              term: "Hook tax",
              text: `Optional Master extra, 0–${MAX_HOOK_TAX_BPS / 100}%, so base + tax ≤ 10%. Funds modules only. Leftover → protocol.`,
            },
            {
              term: "Anti-Snipe",
              text: "Temporary buy-only tax that decays to 0. Its take follows the same 60 / 10 / 30 as the base.",
            },
          ],
        },
        {
          type: "h3",
          text: "Worked example",
        },
        {
          type: "p",
          text: "A 1 ETH buy on a Master pool with 1% base + 2% hook tax. Auto-burn 80% and floor 20% of the hook pot.",
        },
        {
          type: "table",
          headers: ["Slice", "Quote", "Where it goes"],
          rows: [
            ["Base 1%", "0.010 ETH", "0.006 creator · 0.001 $HKT drop · 0.003 protocol"],
            ["Hook tax 2%", "0.020 ETH", "0.016 burn buyback · 0.004 FloorVault"],
            ["Trader pays", "1.030 ETH", "1.000 into the pool + 0.030 fees"],
          ],
        },
        {
          type: "h3",
          text: "Launch fee",
        },
        {
          type: "p",
          text: `${LAUNCH_FEE_ETH} ETH to the factory, plus gas. Not refundable. Separate from swap fees.`,
        },
        {
          type: "callout",
          title: "Fixed at launch",
          items: [
            "Pool LP fee is 0%. The hook is the fee switch.",
            "Hook tax is for modules, not an extra creator skim.",
            "Module percents of the hook pot must sum to 100% when any sink is on.",
            "Creator → Hook and Buyback Vesting cannot both take the creator’s 60%.",
          ],
        },
      ],
    },
    {
      id: "creator-fees",
      title: "Creator fees",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: `The creator’s ${CREATOR_FEE_PCT}% of every 1% base (and of the temporary snipe take) is not paid inside the swap. Where it sits depends on the modules you packed.`,
        },
        {
          type: "defs",
          rows: [
            {
              term: "FeeEscrow (default)",
              text: "MasterLaunchHook.feeEscrow(). Claim quote on the token page. Classic after graduation: sweepQuote(poolId) on GraduatedFeeHook first, then claim.",
            },
            {
              term: "BuybackVault",
              text: "If Buyback Vesting is on. Time vest or FDV cliff/steps. Creator-only claim of the unlocked slice.",
            },
            {
              term: "Hook pot",
              text: "If Creator → Hook is on. The 60% joins floor / burn / deepen / airdrop. Nothing to claim as creator fees.",
            },
          ],
        },
        {
          type: "ul",
          items: [
            "Buyback Vesting and Creator → Hook cannot both be on.",
            "The 10% $HKT drop and 30% protocol cut never go to the creator.",
            "Read live vaults from the hook: feeEscrow(), buybackVault(). Do not trust a stale addresses.json.",
          ],
        },
      ],
    },
    {
      id: "hooks",
      title: "Hook modules",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "MasterLaunchHook is the shared v4 hook. Browse filters on /explore are All → Protection → Tokenomics → Rewards → Trading Fees. Deepen LPs sits in Protection (it thickens the book), not Rewards.",
        },
        {
          type: "hooks",
        },
        {
          type: "h3",
          text: "Protection",
        },
        { type: "hook-title", hookId: "anti-snipe" },
        {
          type: "p",
          text: "High extra buy fee at open. Linear decay to 0 over the window you set. Snipers pay the most in the first seconds.",
        },
        { type: "hook-title", hookId: "anti-mev" },
        {
          type: "p",
          text: "One swap per tx.origin per pool per block. Same-block buy→sell or sell→buy reverts. Not a private mempool.",
        },
        { type: "hook-title", hookId: "max-tx" },
        {
          type: "p",
          text: "Caps a single swap at 0.1%–2.5% of supply. Fixed at launch. Oversized exact-input swaps revert.",
        },
        { type: "hook-title", hookId: "max-wallet" },
        {
          type: "p",
          text: "Caps how much one address can hold after a buy, same 0.1%–2.5% range. Checked post-transfer.",
        },
        { type: "hook-title", hookId: "backed-floor" },
        {
          type: "p",
          text: "Quote vault + ratchet redeem price. Deep dive in the Backed Floor section.",
        },
        { type: "hook-title", hookId: "deepen-lps" },
        {
          type: "p",
          text: "Hook-tax share minted back into the launch LP range as extra liquidity. Thickens the book. Sits in Protection, not Rewards.",
        },
        {
          type: "h3",
          text: "Tokenomics",
        },
        { type: "hook-title", hookId: "auto-burn" },
        {
          type: "p",
          text: "Hook-tax share buys the token from its own pool and burns it. Failed nested buy stays queued.",
        },
        { type: "hook-title", hookId: "buyback-vesting" },
        {
          type: "p",
          text: `Creator’s ${CREATOR_FEE_PCT}% of the 1% base goes to BuybackVault. Time vest or unlock-at-FDV. Full write-up below.`,
        },
        {
          type: "h3",
          text: "Rewards",
        },
        { type: "hook-title", hookId: "holder-airdrop" },
        {
          type: "p",
          text: "Hook pot → HolderAirdropVault in quote. Epoch or FDV target, pro-rata by that token’s balance. Full write-up below.",
        },
        { type: "hook-title", hookId: "creator-share-to-hook" },
        {
          type: "p",
          text: `Routes the creator’s ${CREATOR_FEE_PCT}% of the 1% base into the hook pot instead of escrow. Cannot combine with Buyback Vesting.`,
        },
        {
          type: "p",
          text: `$HKT holder drop is not a module. It is always on. See the $HKT section.`,
        },
        {
          type: "h3",
          text: "Trading fees",
        },
        { type: "hook-title", hookId: "fixed-fee" },
        {
          type: "p",
          text: "Flat extra hook tax on every swap, quote-only. Mutually exclusive with Dynamic Fees.",
        },
        { type: "hook-title", hookId: "dynamic-fees" },
        {
          type: "p",
          text: "Hook tax ramps with in-range LP depth consumed. No oracle. Full write-up below.",
        },
        {
          type: "callout",
          title: "Limits",
          items: [
            "Floor + burn + Deepen LPs + airdrop shares of the hook pot must equal 100% when any of them is on.",
            "Any fee sink needs hook tax > 0 (unless Creator → Hook feeds the pot).",
            "Base 1% + hook tax ≤ 10%.",
            "Classic does not use these modules.",
          ],
        },
      ],
    },
    {
      id: "anti-snipe",
      title: "Anti-Snipe",
      hookId: "anti-snipe",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Buy-only extra tax at open. Linear decay to 0 over the window packed at launch. The take uses the same 60 / 10 / 30 split as the 1% base — it is not hook tax.",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Initial tax",
              text: "Wizard default 98%. Slider 1%–99%. Contract fallback if unset: 50%. Max 9900 bps.",
            },
            {
              term: "Window",
              text: "1–3600 seconds. Wizard default 5 seconds.",
            },
            {
              term: "Cap",
              text: "Base 1% + hook tax + snipe ≤ 100% at open. Steady fee (after decay) still 1% + hook tax ≤ 10%.",
            },
          ],
        },
        {
          type: "formulas",
          items: [
            {
              name: "τ_snipe(t)",
              math: "τ0 · (1 − (t − t0) / T)",
              note: "0 after T. Applied on buys only.",
            },
          ],
        },
      ],
    },
    {
      id: "anti-mev",
      title: "Anti-MEV",
      hookId: "anti-mev",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Transient per-origin lock. One swap per tx.origin per pool per block. A same-block opposing swap (buy then sell, or sell then buy) reverts SandwichBlocked.",
        },
        {
          type: "ul",
          items: [
            "This is not a private mempool and not a builder-only lane.",
            "Same-direction second swap in the same block from the same origin also reverts.",
            "Does not stop cross-block sandwiches or other searchers.",
          ],
        },
      ],
    },
    {
      id: "max-tx",
      title: "Max Tx",
      hookId: "max-tx",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Caps a single swap at 0.1%–2.5% of total supply (10–250 bps). Fixed at launch. Oversized exact-input swaps revert. The check includes the fee in the notional (SupplyCapLib.checkMaxTx).",
        },
      ],
    },
    {
      id: "max-wallet",
      title: "Max Wallet",
      hookId: "max-wallet",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Caps how much one address can hold after a buy, same 0.1%–2.5% range. Checked post-transfer on buys (checkMaxWalletBeforeBuy). Sells are not blocked by this cap.",
        },
      ],
    },
    {
      id: "floor",
      title: "Backed Floor",
      hookId: "backed-floor",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "A Master module. A launch-time share of the hook pot is deposited into FloorVault as quote collateral for that token only. Single-pair only — launchMulti reverts BackedFloorNotAllowedInMulti.",
        },
        {
          type: "diagram",
          id: "floor-loop",
        },
        {
          type: "formulas",
          items: [
            {
              name: "P_floor",
              math: "V_quote / S_circ",
              note: "Quote wei in the vault over circulating token wei. Scaled 1e18 on-chain as floorPriceX18.",
            },
            {
              name: "Redeem",
              math: "q = amount · V_quote / S_circ",
              note: "FloorVault.redeemFloor(token, amount). Burns tokens, pays quote, round down. Remaining holders keep a floor that never decreases.",
            },
            {
              name: "Premium",
              math: "(P_spot − P_floor) / P_floor",
              note: "Hidden while the vault is dust versus launch FDV, so a few cents of collateral is not a +30,000,000% badge.",
            },
          ],
        },
        {
          type: "ul",
          items: [
            "The floor is not pegged to the DEX. Spot can sit far above the vault.",
            "Sells at/below floor can be intercepted in beforeSwap and floor-filled at P_floor.",
            "Empty vault → redeem does nothing until fees refill it.",
            "Floor fills help when spot is already on the floor path the hook implements. They are not a guarantee across every tick jump.",
          ],
        },
      ],
    },
    {
      id: "deepen-lps",
      title: "Deepen LPs",
      hookId: "deepen-lps",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "A share of the hook pot is minted back into the launch LP range as extra liquidity. Protection category — it thickens the book, it does not pay holders.",
        },
        {
          type: "ul",
          items: [
            "Hook tax is queued to pendingDeepenLps[poolId] and minted in afterSwap.",
            "If the nested mint fails, the same amount is re-queued. Funds are not lost.",
            "The token page can show pending deepen from pendingDeepenLps(poolId).",
            "Share of the hook pot must sum to 100% with floor / burn / airdrop when any sink is on.",
          ],
        },
      ],
    },
    {
      id: "auto-burn",
      title: "Auto-Burn",
      hookId: "auto-burn",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "A share of the hook pot buys the launched token from its own pool after the swap and burns it (dead address).",
        },
        {
          type: "ul",
          items: [
            "Queued as pendingAutoBurn[poolId], executed in afterSwap.",
            "Failed nested buy re-queues the same amount.",
            "This is not the protocol $HKT buyback and not Buyback Vesting.",
          ],
        },
      ],
    },
    {
      id: "buyback-vesting",
      title: "Buyback Vesting",
      hookId: "buyback-vesting",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: `When this module is on, the creator does not take the ${CREATOR_FEE_PCT}% of the 1% base in FeeEscrow. That cut goes to BuybackVault and unlocks on a clock, or when fully-diluted mcap prints a USD target packed at launch in vestPacked (low 128 bits) — not in the module bitmask.`,
        },
        {
          type: "defs",
          rows: [
            {
              term: "Time vest",
              text: "Linear unlock from 7 days to 5 years. Claim the unlocked slice on the token page.",
            },
            {
              term: "Until FDV",
              text: "Cliff presets start at $10M (not $5M): $10M, $50M, $100M, $500M, $1B, $10B. All at the cliff, or by % at each rung (percents must sum to 100).",
            },
            {
              term: "Ratchet",
              text: "observeFdv on each swap. High-water FDV. A dump after the unlock does not relock fees already freed.",
            },
          ],
        },
        {
          type: "ul",
          items: [
            `Cannot combine with Creator → Hook. Both spend the same ${CREATOR_FEE_PCT}% creator cut.`,
            "The 10% $HKT drop and the 30% protocol cut are unchanged.",
            "Buyers can see the vest on the token page. Instant creator dump of trading fees is off the table.",
          ],
        },
        {
          type: "callout",
          title: "Name",
          items: [
            "“Buyback” here means the creator’s proceeds sit in BuybackVault, not that the hook market-buys $HKT for the creator.",
            "Protocol $HKT buyback is a separate 80% of the protocol pot (HkitBuyback.execute, then burn).",
          ],
        },
      ],
    },
    {
      id: "holder-airdrop",
      title: "Holder Airdrop",
      hookId: "holder-airdrop",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Optional Master module. A launch-time share of the hook pot accrues in HolderAirdropVault as quote (ETH, USDG, or wStock). Holders of that launched token get paid — not $HKT holders. That other flow is the $HKT section.",
        },
        {
          type: "defs",
          rows: [
            {
              term: "Time window",
              text: "Default epoch 15 minutes. Min 60 seconds, max 7 days. The next swap after the epoch can push a batch (tryAutoAirdrop).",
            },
            {
              term: "Until FDV",
              text: "Keep drops locked until FDV hits $5M–$10B (airdrop may use the $5M preset; buyback vest starts at $10M). Unlock all at the cliff, or by % at each rung (must sum to 100). Packed in vestPacked high 128 bits.",
            },
            {
              term: "Holder set",
              text: "On-chain. LaunchToken.holderTracker = HolderAirdropVault; every transfer calls syncHolder. Not supplied by the indexer.",
            },
            {
              term: "Payout",
              text: "Uniswap v4 ERC-6909 quote claims via claimsManager.transfer. Holders redeem with PoolManager.setOperator(redeemer, true) then V4ClaimsRedeemer.claim(quote).",
            },
          ],
        },
        {
          type: "ul",
          items: [
            "Needs hook tax > 0 (or Creator → Hook feeding the pot) so there is something to accrue.",
            "Share of the hook pot must sum to 100% with floor / burn / Deepen LPs when any sink is on.",
            "Permissionless. Anyone can trigger the push once the epoch is ready.",
            "Max 48 holders per batch so a swap stays inside the gas envelope.",
            "Pool, hook, and vault addresses are excluded. The holder list must cover circulating or the push reverts.",
          ],
        },
        {
          type: "formulas",
          items: [
            {
              name: "payout_i",
              math: "pot · bal_i / Σ bal",
              note: "Quote pot for this epoch × wallet balance of the launched token over circulating (exclusions applied).",
            },
          ],
        },
      ],
    },
    {
      id: "creator-share",
      title: "Creator → Hook",
      hookId: "creator-share-to-hook",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: `Routes the creator’s ${CREATOR_FEE_PCT}% of the 1% base into the hook pot instead of FeeEscrow. Same module split as hook tax (floor / burn / deepen / airdrop).`,
        },
        {
          type: "ul",
          items: [
            "Cannot combine with Buyback Vesting.",
            "The 1% base is unchanged. Only the creator slice is redirected.",
            "A fee sink can run with hook tax = 0 if this module feeds the pot.",
          ],
        },
      ],
    },
    {
      id: "fixed-fees",
      title: "Fixed Fees",
      hookId: "fixed-fee",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Flat extra hook tax on every swap, quote-only. Mutually exclusive with Dynamic Fees. Leftover hook tax (not routed to a sink) joins the protocol pot.",
        },
        {
          type: "ul",
          items: [
            "You set hook tax at launch. Base 1% + hook tax ≤ 10%.",
            "Hook tax never uses the 60 / 10 / 30 split. That split is only the 1% base (and snipe).",
          ],
        },
      ],
    },
    {
      id: "dynamic-fees",
      title: "Dynamic Fees",
      hookId: "dynamic-fees",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "Optional Master fee mode. The extra hook tax is not a flat bps. It scales with how much of the in-range book the swap eats. A small clip on a deep book stays cheap. The same clip on a thin book pays more. No oracle, no 24h volume window — only current Uniswap v4 liquidity in the launch ticks.",
        },
        {
          type: "formulas",
          items: [
            {
              name: "c",
              math: "n / d",
              note: "Quote notional of this swap over in-range quote depth in the trade direction.",
            },
            {
              name: "r",
              math: "min(1, c / σ)",
              note: "σ is the depth-saturation fraction set at launch (default 100% of in-range depth).",
            },
            {
              name: "τ_hook",
              math: "τ_min + (τ_max − τ_min) · r",
              note: "Added on top of the 1% base. Empty depth stays at τ_min so a first buy does not 100% revert.",
            },
          ],
        },
        {
          type: "ul",
          items: [
            "You set a min total fee and a max hook tax at launch. Base 1% + max hook tax ≤ 10%.",
            "Cannot combine with Fixed Fees. One extra-tax mode per pool.",
            "The 1% base still splits 60 / 10 / 30. Only the hook-tax slice ramps.",
            "Whale-sized flow pays for the depth it consumes. Retail on a healthy book stays near the floor fee.",
          ],
        },
      ],
    },
    {
      id: "math",
      title: "Formulas",
      group: "Modules",
      blocks: [
        {
          type: "p",
          text: "The identities the contracts enforce. BPS_DENOMINATOR = 10_000. Amounts are integer wei.",
        },
        {
          type: "formulas",
          title: "Swap fee",
          items: [
            {
              name: "fee_total",
              math: "1% + τ_hook + τ_snipe",
              note: "Capped so 1% + τ_hook ≤ 10%. Snipe is buy-only and temporary.",
            },
            {
              name: "τ_snipe(t)",
              math: "τ0 · (1 − (t − t0) / T)",
              note: "0 after the launch window T. Linear decay from the initial tax τ0.",
            },
            {
              name: "base split",
              math: "0.60 creator + 0.10 $HKT + 0.30 protocol",
              note: "Applied to the 1% base and to the snipe take. Hook tax never uses this split.",
            },
          ],
        },
        {
          type: "formulas",
          title: "Dynamic hook tax",
          items: [
            {
              name: "c",
              math: "n / d",
              note: "Quote notional of the swap over in-range quote depth in the trade direction.",
            },
            {
              name: "r",
              math: "min(1, c / σ)",
              note: "σ is the depth-saturation fraction set at launch (default 100% of in-range depth).",
            },
            {
              name: "τ_hook",
              math: "τ_min + (τ_max − τ_min) · r",
              note: "No oracle. Empty depth stays at τ_min so a first buy does not 100% revert.",
            },
          ],
        },
        {
          type: "formulas",
          title: "Uniswap spot",
          items: [
            {
              name: "P",
              math: "(sqrtPriceX96 / 2^96)^2",
              note: "Quote per token if the launch token is currency0; invert if it is currency1.",
            },
            {
              name: "FDV",
              math: "P · 10^9 · FX",
              note: "FX is ETH/USD TWAP or Quotrons wStock/USDG (USDG ≈ $1).",
            },
          ],
        },
        {
          type: "formulas",
          title: "Classic curve",
          items: [
            {
              name: "k",
              math: "Q_virt · T_virt",
              note: "Virtual constant-product. Start virtual quote is 1 ETH-equivalent.",
            },
            {
              name: "buy",
              math: "ΔT = T − k / (Q + ΔQ)",
              note: "Tokens out for quote in, before the 1% fee.",
            },
            {
              name: "graduate",
              math: "Q_real ≥ 4.2 ETH-eq",
              note: "Or the same USD value in USDG / wStock. 20% of supply seeds full-range LP.",
            },
          ],
        },
        {
          type: "formulas",
          title: "$HKT holder drop",
          items: [
            {
              name: "buy",
              math: "V · 1% · 10%",
              note: "Quote volume × base fee × holder share. Buys the launched token, not $HKT.",
            },
            {
              name: "share_i",
              math: "bal_i($HKT) / Σ bal($HKT)",
              note: "Live balances. LP and protocol sinks are excluded from the weight.",
            },
          ],
        },
        {
          type: "formulas",
          title: "Protocol pot",
          items: [
            {
              name: "ops",
              math: "0.20 · protocol",
              note: "Operating wallet.",
            },
            {
              name: "buyback",
              math: "0.80 · protocol",
              note: "ETH stays ETH. wStock converts to USDG on Quotrons, then to the buyback wallet.",
            },
          ],
        },
      ],
    },
    {
      id: "analytics",
      title: "Analytics",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "/stats is the public protocol dashboard. It is not a price feed and not a promise of revenue.",
        },
        {
          type: "ul",
          items: [
            "Volume windows: 24h / 7d / 30d / all, from GET /v1/protocol/stats.",
            "Implied protocol take = volume × the 1% schedule (hook tax is extra and not in that KPI).",
            "$HKT holder-drop estimate from volume, plus tokens sent / wallets from the indexer.",
            "Pending buyback ETH on the distributor and burned $HKT from HkitBuyback BuybackBurned logs.",
          ],
        },
      ],
    },
    {
      id: "integration",
      title: "For developers",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Everything on the site can be rebuilt from public chain data. The indexer is a convenience layer and can lag. Prefer same-origin /api/indexer on hookit.fun so CORS stays on the server.",
        },
        {
          type: "h3",
          text: "Indexer HTTP",
        },
        {
          type: "code",
          title: "indexer.hookit.fun",
          code: `GET /health
GET /v1/protocol/stats
GET /v1/tokens
GET /v1/tokens/:address?poolId=
GET /v1/tokens/:address/trades?limit=50&offset=0&poolId=
GET /v1/tokens/:address/holders?limit=50
GET /v1/tokens/:address/candles?limit=200&poolId=&interval=5m|1m`,
        },
        {
          type: "ul",
          items: [
            "Token summary includes markets[], marketCount, bondingPhase, realQuote, graduationQuote, hookModules, windows (5m/1h/6h/24h), and devBuy*.",
            "Candles default 5m. Pass interval=1m for 60s buckets. Chart is mcap-based.",
            "/health exposes cursor, lagBlocks, lastPollError.",
            "On-chain: TokenLaunched, PoolManager Swap, bonding Bought / Sold / Graduated, StateView.getSlot0, LaunchToken.metadataURI.",
          ],
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
          text: `Production is Ink. Integration and CI still use Base Sepolia. Your wallet must match the app chain (${network}).`,
        },
        {
          type: "defs",
          rows: [
            { term: "Network", text: network },
            { term: "Chain ID", text: String(dep.chainId) },
            { term: "Gas", text: "ETH" },
            { term: "RPC", text: rpc },
            { term: "Explorer", text: dep.explorer },
            { term: "Supply", text: "1,000,000,000 (both rails)" },
            { term: "Master start FDV", text: `~$${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")}` },
            { term: "Classic graduate", text: `~${GRADUATION_ETH} ETH equivalent` },
            {
              term: "Quotes",
              text: chainKey === "ink" ? "ETH, USDG, Quotrons wStocks" : "ETH and USDC on Base Sepolia",
            },
            { term: "Site", text: "https://www.hookit.fun" },
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
          text: "Addresses the UI hardcodes for this build. They win over a stale deploy/ink/addresses.json. Vaults and the live MasterLaunchHook are not listed here — read them from the hook: floorVault(), feeEscrow(), buybackVault(), holderAirdropVault(), hktDropVault(). Old factories stay on-chain and are hidden from Explore.",
        },
        {
          type: "contract",
          label: "LaunchFactory",
          address: addr(factory),
          note: "Active Master launches",
        },
        {
          type: "contract",
          label: "LaunchFactoryQuery",
          address: addr(factoryQuery),
          note: "Paginated launch index",
        },
        {
          type: "contract",
          label: "BondingLaunchFactory",
          address: addr(bonding),
          note: "Classic rail",
        },
        {
          type: "contract",
          label: "HookitSwapRouter",
          address: addr(router),
          note: "Required for hooked swaps",
        },
        {
          type: "contract",
          label: "ProtocolRevenueDistributor",
          address: addr(distributor),
        },
        {
          type: "contract",
          label: "HkitBuyback",
          address: addr(buyback),
          note: "Permissionless execute → burn $HKT",
        },
        {
          type: "contract",
          label: "V4ClaimsRedeemer",
          address: addr(claims),
          note: "Redeem Holder Airdrop ERC-6909 claims",
        },
        {
          type: "contract",
          label: "Native token",
          address: addr(native),
          note: "Protocol $HKT / current Ink native",
        },
        {
          type: "divider",
          label: "Uniswap v4 on this chain",
        },
        {
          type: "contract",
          label: "PoolManager",
          address: dep.poolManager,
        },
        {
          type: "contract",
          label: "StateView",
          address: dep.stateView,
        },
        {
          type: "contract",
          label: "V4 Quoter",
          address: dep.v4Quoter,
        },
        {
          type: "contract",
          label: "Universal Router",
          address: dep.universalRouter,
          note: "Not used for hooked Hookit pools",
        },
        {
          type: "contract",
          label: "Stable quote",
          address: dep.stableQuote,
          note: chainKey === "ink" ? "USDG" : "USDC",
        },
        {
          type: "contract",
          label: "ETH/USD",
          address: dep.ethUsdFeed,
          note: chainKey === "ink" ? "WETH/USDt0 Uniswap v3 30m TWAP" : "Chainlink",
        },
      ],
    },
    {
      id: "events",
      title: "Onchain events",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Index from the factory deploy block. Paginate getLogs — public RPCs time out on wide ranges.",
        },
        {
          type: "ul",
          items: [
            "LaunchFactory.TokenLaunched — Master (or custom hook) launch.",
            "LaunchFactory.MultiLaunchConfigured / MarketLaunched — multi-pair.",
            "BondingLaunchFactory.TokenLaunched / Bought / Sold / Graduated.",
            "PoolManager.Swap — Master and graduated Classic trades.",
            "HktHolderDropVault.Credited / Dropped — $HKT holder drop.",
            "HkitBuyback.BuybackBurned — protocol $HKT burn.",
            "FloorVault.Deposited / Redeemed.",
            "GraduatedFeeHook.FeesAccrued / Swept — Classic creator fees.",
            "FeeEscrow.Claimed — creator pull.",
          ],
        },
        {
          type: "code",
          title: "List Master launches (viem)",
          code: `import { createPublicClient, http, parseAbiItem } from "viem";

const client = createPublicClient({
  chain: { id: ${dep.chainId}, name: "${network}", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["${rpc}"] } } },
  transport: http(),
});

const launches = await client.getLogs({
  address: "${addr(factory, "LAUNCH_FACTORY")}",
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
          text: "Each launch has a numeric launchId. From there: token, pool, creator, bitmask, quote asset.",
        },
        {
          type: "code",
          title: "Paginate launches",
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
          text: "Unpack the bitmask for modules. vestPacked is a separate uint256 (low 128 = buyback plan, high 128 = airdrop plan). metadataURI holds image and socials. Charts and holder ranks need the indexer or your own Transfer scan.",
        },
        {
          type: "code",
          title: "Bitmask layout (BitmaskConfig)",
          code: `bit 0        ANTI_SNIPE
bit 1        BACKED_FLOOR
bit 2        ANTI_MEV
bit 3        MAX_TX
bit 4        MAX_WALLET
bit 5        DYNAMIC_FEES
bit 6        BUYBACK_VESTING
bits 7-22    hookTaxBps
bits 23-38   antiSnipeDurationSeconds
bits 39-54   maxTxBps
bits 55-70   maxWalletBps
bits 71-94   floorAllocationBps
bits 95-110  initialSnipeTaxBps
bit 111      AUTO_BURN
bit 112      DEEPEN_LPS
bits 113-128 autoBurnBps
bits 129-144 deepenLpsBps
bit 145      HOLDER_AIRDROP
bits 146-161 holderAirdropBps
bit 162      CREATOR_SHARE_TO_HOOK
bits 163-194 buybackVestingDurationSeconds
bits 195-210 dynamicFeeMinTotalBps
bits 212-227 dynamicFeeDepthSaturationBps
bits 228-259 holderAirdropEpochSeconds`,
        },
      ],
    },
    {
      id: "pricing",
      title: "Pricing",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Master / graduated spot is sqrtPriceX96. Classic pre-graduation is virtual reserves. USD multiplies by the chain feed.",
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
          text: "Floor: FloorVault.floorPriceX18(token). UI liquidity is TVL in USD, not raw Uniswap L. Ink ETH/USD is a guarded WETH/USDt0 Uniswap v3 30-minute TWAP (max observation age 1 hour).",
        },
      ],
    },
    {
      id: "risks",
      title: "Risks",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Tokens are user-created. hookit does not vet tickers, teams, or hook combinations.",
        },
        {
          type: "ul",
          items: [
            "You can lose everything. Prices are violent and many tokens go to zero.",
            "Copycat names, logos, and socials are normal. Check the contract every time.",
            "Contracts may have bugs. Not every configuration is audited.",
            "Custom hooks (when enabled) can honeypot, tax, or block sells.",
            "Low liquidity means the printed price is not an exit.",
            "RPC, wallet, and indexer outages show stale or empty UI.",
            "Limit/stop alerts need your browser open.",
            "Explore flags original vs copycat tickers. A green OG badge is not a vet.",
          ],
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
          text: `Bugs and integration questions: ${GITHUB_REPO_URL}. Include chain, token, tx hash, and wallet.`,
        },
        {
          type: "p",
          text: "No support SLA. Software is early.",
        },
      ],
    },
    {
      id: "terms",
      title: "Terms",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Full terms and privacy live on /terms and /privacy. Short version: software only, no custody, no advice, no refunds.",
        },
        {
          type: "ul",
          items: [
            "Brand: hookit (hookit.fun).",
            "Do not imply partnership, listing, or audited status.",
            "On-chain data is public. You are responsible for how you use it.",
          ],
        },
      ],
    },
  ];
}
