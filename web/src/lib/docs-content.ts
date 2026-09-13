import {
  BASE_FEE_BPS,
  CREATOR_SHARE_BPS,
  CUSTOM_SOLIDITY_HOOKS_ENABLED,
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
  getHkitBuybackAddress,
  getHookitSwapRouterAddress,
  getLaunchFactoryAddress,
  getNativeTokenAddress,
  getProtocolDistributorAddress,
} from "@/lib/contracts/config";
import { getDefaultRpcUrl, getNetworkLabel, resolveHookitChainKey } from "@/lib/chains";

export type DocsSectionId =
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

export type DocsDiagramId =
  | "rails"
  | "stack"
  | "flywheel"
  | "fee-split"
  | "swap-lifecycle"
  | "classic-curve"
  | "floor-loop";

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
  | { type: "table"; headers: string[]; rows: string[][] };

export type DocsSection = {
  id: DocsSectionId;
  title: string;
  group: "Introduction" | "Protocol" | "Reference";
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
    ],
  },
  {
    group: "Protocol",
    items: [
      { id: "launches", label: "How launches work" },
      { id: "trading", label: "Trading" },
      { id: "graduation", label: "Graduation" },
      { id: "fees", label: "Fees and flywheel" },
      { id: "hooks", label: "Hook modules" },
      { id: "floor", label: "Backed Floor" },
      { id: "math", label: "Formulas" },
    ],
  },
  {
    group: "Reference",
    items: [
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
  const bonding = getBondingFactoryAddress();
  const router = getHookitSwapRouterAddress();
  const distributor = getProtocolDistributorAddress();
  const buyback = getHkitBuybackAddress();
  const native = getNativeTokenAddress();

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
            "Explore. Browse launches, filter by hook, read live stats.",
            "Launch. Master wizard (token, protection, tokenomics, fees, split, review) or Classic bonding.",
            "Trade. Market swap on the token page through HookitSwapRouter so hook rules stay applied.",
            "Portfolio. Tokens you created or hold, tied to the connected wallet.",
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
            "Quotrons wStock quotes (wAAPLx, wNVDAx, …) as launch pairs on Ink.",
            "Optional multi-pair markets on one token, with a keeper for inventory.",
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
              title: "Token",
              text: "Name, ticker, image, links. Metadata is stored on-chain. Images can pin to IPFS.",
            },
            {
              num: "03",
              title: "Rail",
              text: "Master: pick quote (ETH, USDG, or a Quotrons wStock), then stack hooks. Classic: bonding curve only.",
            },
            {
              num: "04",
              title: "Sign",
              text: "Master deploys token + pool + locked LP. Classic opens the curve. Optional same-tx dev buy.",
            },
            {
              num: "05",
              title: "Live",
              text: "The token hits Explore and gets a desk: chart, holders, swap, hook chips.",
            },
          ],
        },
        {
          type: "h3",
          text: "Master (Launch Studio)",
        },
        {
          type: "p",
          text: "Wizard order: Token & pair → Protection → Tokenomics → Trading fees → Fee split → Review. On-chain this is LaunchFactory + MasterLaunchHook.",
        },
        {
          type: "ul",
          items: [
            "1,000,000,000 tokens, 18 decimals, fixed supply.",
            `Start price targets ~$${TARGET_LAUNCH_MCAP_USD.toLocaleString("en-US")} FDV in the chosen quote.`,
            "Uniswap v4 pool fee tier is 0%. The hook charges instead, quote-only.",
            "Liquidity is minted in a locked range. The creator cannot pull that LP.",
            "Trading is live in the same transaction.",
            "Optional modules pack into a uint256 bitmask. Frozen after launch.",
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
          title: "Custom Solidity hooks",
          items: [
            CUSTOM_SOLIDITY_HOOKS_ENABLED
              ? "You can paste your own v4 hook. hookit mines CREATE2 flags and deploys from your wallet. Unreviewed."
              : "Custom Solidity hooks are off for the Ink soft launch. The UI and factory allowlist stay closed until an audit.",
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
          text: "Master and graduated pools need HookitSwapRouter so fee take, floor fills, burns, and airdrop pushes run. A generic DEX UI can skip hook accounting or revert. Composite buys (pay USDG for a wStock pool, or ETH for a stable pool) route leg 1 on an allowed bridge, then leg 2 on the launch pool.",
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
        {
          type: "ul",
          items: [
            "Anti-Snipe. High extra buy fee at open, linear decay to 0 over the window.",
            "Anti-MEV. One swap per tx.origin per pool per block.",
            "Max Tx / Max Wallet. 0.1%–2.5% of supply, fixed at launch.",
            "Backed Floor. Quote vault + ratchet redeem price. See the floor section.",
            "Deepen LPs. Hook-tax share minted back into the launch LP range as extra liquidity.",
          ],
        },
        {
          type: "h3",
          text: "Tokenomics",
        },
        {
          type: "ul",
          items: [
            "Auto-Burn. Hook-tax share buys the token and burns it. Failed nested buy stays queued.",
            "Buyback Vesting. Creator’s 60% of base goes to BuybackVault. Linear time vest or unlock-at-FDV ($10M–$10B).",
          ],
        },
        {
          type: "h3",
          text: "Rewards",
        },
        {
          type: "ul",
          items: [
            "Holder Airdrop. Hook pot → HolderAirdropVault in quote. Epoch or FDV target, pro-rata by token balance.",
            "Creator → Hook. Routes the creator’s 60% of the 1% base into the hook pot instead of escrow.",
            `$HKT holder drop is not a module. It is always on: ${HKT_HOLDER_FEE_PCT}% of the 1% base buys the launched token for live $HKT holders.`,
          ],
        },
        {
          type: "h3",
          text: "Trading fees",
        },
        {
          type: "ul",
          items: [
            "Fixed Fees. Flat extra hook tax on every swap, quote-only.",
            "Dynamic Fees. Hook tax ramps with how much in-range LP depth the swap consumes. No oracle.",
          ],
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
      id: "floor",
      title: "Backed Floor",
      group: "Protocol",
      blocks: [
        {
          type: "p",
          text: "A Master module. A launch-time share of the hook pot is deposited into FloorVault as quote collateral for that token only.",
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
              note: "Round down. Remaining holders keep a floor that never decreases.",
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
            "Spot cannot sustainably trade below the floor: redeem / floor-fill is a quote bid at P_floor.",
            "Empty vault → redeem does nothing until fees refill it.",
            "Floor fills help when spot is already on the floor path the hook implements. They are not a guarantee across every tick jump.",
          ],
        },
      ],
    },
    {
      id: "math",
      title: "Formulas",
      group: "Protocol",
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
      id: "integration",
      title: "For developers",
      group: "Reference",
      blocks: [
        {
          type: "p",
          text: "Everything on the site can be rebuilt from public chain data. The indexer is a convenience layer and can lag.",
        },
        {
          type: "ul",
          items: [
            "Launches — TokenLaunched on LaunchFactory / BondingLaunchFactory.",
            "Trades — PoolManager Swap, plus bonding Bought / Sold.",
            "Spot — StateView.getSlot0(poolId) or the v4 Quoter.",
            "Metadata — LaunchToken.metadataURI.",
            "Indexer — GET /v1/tokens, /trades, /holders, /candles on indexer.hookit.fun.",
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
          text: "Hookit factories and the router the UI uses on this build, then the shared Uniswap v4 core. Deployed bytecode is immutable; a cutover is a new address.",
        },
        {
          type: "contract",
          label: "LaunchFactory",
          address: addr(factory),
          note: "Master launches",
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
            "BondingLaunchFactory.TokenLaunched / Bought / Sold / Graduated.",
            "PoolManager.Swap — Master and graduated Classic trades.",
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
          text: "Unpack the bitmask for modules. metadataURI holds image and socials. Charts and holder ranks need the indexer or your own Transfer scan.",
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
          text: "Floor: FloorVault.floorPriceX18(token). UI liquidity is TVL in USD, not raw Uniswap L.",
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
