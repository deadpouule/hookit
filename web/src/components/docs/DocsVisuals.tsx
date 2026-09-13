import type { ReactNode } from "react";

import { PoweredByQuotronsBadge } from "@/components/brand/PoweredByQuotronsBadge";
import { HookLogo } from "@/components/home/market/HookLogo";
import { MultiPairGlyph } from "@/components/home/market/CategoryGlyphs";
import { PairingMark } from "@/components/launch/PairingMark";
import type { DocsVisualId } from "@/lib/docs-content";
import type { BrowseHookId, HookTheme } from "@/lib/master-hooks";
import { GITHUB_REPO_URL } from "@/lib/constants";

function Figure({
  caption,
  note,
  children,
}: {
  caption: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      {children}
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}

function Flow({
  nodes,
}: {
  nodes: { t: string; d: string; icon?: ReactNode }[];
}) {
  return (
    <ol className="docs-lifecycle">
      {nodes.map((node, i) => (
        <li key={node.t}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          {node.icon ? <div className="docs-visual-icon">{node.icon}</div> : null}
          <h4>{node.t}</h4>
          <p>{node.d}</p>
        </li>
      ))}
    </ol>
  );
}

function HookMark({ hookId, theme }: { hookId: BrowseHookId; theme: HookTheme }) {
  return <HookLogo hookId={hookId} theme={theme} className="docs-visual-hook" />;
}

function Spark({
  d,
  fill,
  stroke,
  labels,
}: {
  d: string;
  fill: string;
  stroke: string;
  labels: { x: number; y: number; text: string }[];
}) {
  return (
    <svg className="docs-spark" viewBox="0 0 360 120" role="img">
      <path d={d} fill={fill} />
      <path d={d.replace(/Z$/, "")} fill="none" stroke={stroke} strokeWidth="2.2" />
      {labels.map((label) => (
        <text key={label.text} x={label.x} y={label.y} fill="#a1a1aa" fontSize="10">
          {label.text}
        </text>
      ))}
    </svg>
  );
}

export function DocsVisual({ id }: { id: DocsVisualId }) {
  switch (id) {
    case "wizard":
      return (
        <Figure caption="Master launch wizard" note="Six steps. Bitmask and vestPacked freeze at launch.">
          <ol className="docs-wizard">
            {["Token & pair", "Protection", "Tokenomics", "Trading fees", "Fee split", "Review"].map((step, i) => (
              <li key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </Figure>
      );
    case "multi-pair":
      return (
        <Figure
          caption="One token, many quote pools"
          note="Supply splits by bps (must sum to 10_000). Same Master bitmask on every pool."
        >
          <div className="docs-multi">
            <div className="docs-multi-head">
              <span className="token-type-badge token-type-badge--multi-pair">
                <MultiPairGlyph className="token-type-badge-glyph" />
                Multi pair
              </span>
              <p>$TICKER</p>
            </div>
            <div className="docs-multi-legs">
              {[
                { id: "eth" as const, label: "ETH", bps: "40%" },
                { id: "usdg" as const, label: "USDG", bps: "30%" },
                { id: "wnvdax" as const, label: "wNVDAx", bps: "30%" },
              ].map((leg) => (
                <div key={leg.label} className="docs-multi-leg">
                  <PairingMark id={leg.id} size="sm" />
                  <strong>{leg.label}</strong>
                  <small>{leg.bps} pool</small>
                </div>
              ))}
            </div>
          </div>
        </Figure>
      );
    case "quotrons":
      return (
        <Figure
          caption="Launch against wrapped equities"
          note="wStock pools take USDG on the buy panel. HookitSwapRouter bridges on an allowed Quotrons pool."
        >
          <div className="docs-quotrons">
            <PoweredByQuotronsBadge variant="hero" className="docs-quotrons-badge" />
            <div className="docs-quotrons-row">
              {(["waaplx", "wnvdax", "wtslax", "wspyx", "usdg"] as const).map((id) => (
                <PairingMark key={id} id={id} size="sm" />
              ))}
            </div>
          </div>
        </Figure>
      );
    case "trading":
      return (
        <Figure caption="Hooked swap path">
          <Flow
            nodes={[
              { t: "Wallet", d: "Sign buy or sell" },
              { t: "HookitSwapRouter", d: "Required — generic DEX UIs skip hook accounting" },
              { t: "v4 pool", d: "Fee tier 0. Spot is sqrtPriceX96" },
              { t: "MasterLaunchHook", d: "Quote fee, modules, then 60 / 10 / 30" },
            ]}
          />
        </Figure>
      );
    case "creator-fees":
      return (
        <Figure caption="Where the creator 60% sits" note="The 10% $HKT drop and 30% protocol cut never go to the creator.">
          <div className="docs-three">
            <article>
              <h4>FeeEscrow</h4>
              <p>Default. Claim quote on the token page.</p>
            </article>
            <article>
              <h4>BuybackVault</h4>
              <p>If vesting is on. Clock or FDV unlock.</p>
            </article>
            <article>
              <h4>Hook pot</h4>
              <p>If Creator → Hook. No creator claim.</p>
            </article>
          </div>
        </Figure>
      );
    case "anti-snipe-decay":
      return (
        <Figure caption="Snipe tax decays to zero" note="Buy-only. Same 60 / 10 / 30 split as the 1% base — not hook tax.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="anti-snipe" theme="fire" />
            <Spark
              d="M16 18 L16 18 L40 22 C 80 28, 140 48, 210 78 C 260 96, 310 108, 344 110 L 344 110 L 16 110 Z"
              fill="rgb(239 68 68 / 0.18)"
              stroke="#ef4444"
              labels={[
                { x: 16, y: 14, text: "τ0 (default 98%)" },
                { x: 292, y: 104, text: "T → 0" },
              ]}
            />
          </div>
        </Figure>
      );
    case "anti-mev":
      return (
        <Figure caption="One origin, one swap, one block">
          <div className="docs-visual-hook-row">
            <HookMark hookId="anti-mev" theme="steel" />
            <div className="docs-mev">
              <div className="docs-mev-ok">
                <span>Block N</span>
                <strong>tx.origin A — buy</strong>
                <small>Allowed</small>
              </div>
              <div className="docs-mev-no">
                <span>Same block</span>
                <strong>tx.origin A — sell</strong>
                <small>SandwichBlocked</small>
              </div>
            </div>
          </div>
        </Figure>
      );
    case "max-tx":
      return (
        <Figure caption="Single-swap supply cap" note="0.1%–2.5% of supply. Oversized exact-input reverts.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="max-tx" theme="yellow" />
            <div className="docs-cap">
              <div className="docs-cap-track">
                <span className="docs-cap-fill" style={{ width: "42%" }} />
                <i style={{ left: "100%" }} />
              </div>
              <p>
                This swap <b>1.05%</b>
                <span>Cap 2.50%</span>
              </p>
            </div>
          </div>
        </Figure>
      );
    case "max-wallet":
      return (
        <Figure caption="Post-buy wallet cap" note="Same 0.1%–2.5% range. Sells are not blocked by this cap.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="max-wallet" theme="ice" />
            <div className="docs-cap">
              <div className="docs-cap-track">
                <span className="docs-cap-fill docs-cap-fill--ice" style={{ width: "88%" }} />
                <i style={{ left: "100%" }} />
              </div>
              <p>
                Wallet after buy <b>2.20%</b>
                <span>Cap 2.50%</span>
              </p>
            </div>
          </div>
        </Figure>
      );
    case "deepen-lps":
      return (
        <Figure caption="Hook tax minted back into LP">
          <div className="docs-visual-hook-row">
            <HookMark hookId="deepen-lps" theme="nature" />
            <Flow
              nodes={[
                { t: "Hook pot", d: "Your deepen % of tax" },
                { t: "Queue", d: "pendingDeepenLps" },
                { t: "afterSwap mint", d: "Same launch tick range" },
                { t: "Thicker book", d: "LpDeepened on the chip" },
              ]}
            />
          </div>
        </Figure>
      );
    case "auto-burn":
      return (
        <Figure caption="Hook tax buys and burns the meme">
          <div className="docs-visual-hook-row">
            <HookMark hookId="auto-burn" theme="crimson" />
            <Flow
              nodes={[
                { t: "Hook pot", d: "Your burn % of tax" },
                { t: "Nested buy", d: "Same pool, afterSwap" },
                { t: "Dead address", d: "Supply shrinks" },
                { t: "Not $HKT", d: "Separate from protocol buyback" },
              ]}
            />
          </div>
        </Figure>
      );
    case "buyback-vesting":
      return (
        <Figure caption="Creator 60% unlocks later" note="Cannot combine with Creator → Hook. $HKT 10% stays mandatory.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="buyback-vesting" theme="void" />
            <div className="docs-three">
              <article>
                <h4>Time vest</h4>
                <p>Linear 7 days → 5 years.</p>
              </article>
              <article>
                <h4>Until FDV</h4>
                <p>Cliff from $10M, or by % rungs.</p>
              </article>
              <article>
                <h4>Claim</h4>
                <p>Creator-only, unlocked slice.</p>
              </article>
            </div>
          </div>
        </Figure>
      );
    case "holder-airdrop":
      return (
        <Figure
          caption="Quote to holders of that token"
          note="Optional module. Not the mandatory $HKT drop. You receive ETH / USDG / wStock, not the meme."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="holder-airdrop" theme="gold" />
            <Flow
              nodes={[
                { t: "Hook pot", d: "Your airdrop % of tax" },
                { t: "HolderAirdropVault", d: "Quote accrues" },
                { t: "Epoch or FDV", d: "tryAutoAirdrop" },
                { t: "Holders of $TICKER", d: "Pro-rata that token, not $HKT" },
              ]}
            />
          </div>
        </Figure>
      );
    case "creator-share":
      return (
        <Figure caption="Creator 60% feeds the hook pot">
          <div className="docs-visual-hook-row">
            <HookMark hookId="creator-share-to-hook" theme="lime" />
            <Flow
              nodes={[
                { t: "1% base", d: "Still 60 / 10 / 30" },
                { t: "Creator 60%", d: "Redirected" },
                { t: "Hook pot", d: "Floor / burn / deepen / airdrop" },
                { t: "No escrow", d: "Nothing to claim as fees" },
              ]}
            />
          </div>
        </Figure>
      );
    case "fixed-fees":
      return (
        <Figure caption="Flat extra hook tax" note="Mutually exclusive with Dynamic Fees. 1% + tax ≤ 10%.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="fixed-fee" theme="cobalt" />
            <div className="docs-fee-bars">
              <div>
                <span>Base 1%</span>
                <b style={{ width: "20%" }} />
              </div>
              <div>
                <span>Hook tax</span>
                <b className="is-tax" style={{ width: "40%" }} />
              </div>
            </div>
          </div>
        </Figure>
      );
    case "dynamic-fees":
      return (
        <Figure caption="Tax ramps with depth eaten" note="No oracle. Empty book stays at τ_min so the first buy does not revert.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="dynamic-fees" theme="teal" />
            <Spark
              d="M16 96 L16 96 C 70 94, 120 88, 170 70 C 230 48, 280 28, 344 18 L 344 110 L 16 110 Z"
              fill="rgb(45 212 191 / 0.16)"
              stroke="#2dd4bf"
              labels={[
                { x: 16, y: 88, text: "τ_min" },
                { x: 300, y: 16, text: "τ_max" },
              ]}
            />
          </div>
        </Figure>
      );
    case "math-index":
      return (
        <Figure caption="What the identities cover">
          <div className="docs-math-index">
            {["Swap fee", "Dynamic τ", "Uniswap spot", "Classic curve", "$HKT drop", "Protocol pot"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </Figure>
      );
    case "analytics":
      return (
        <Figure caption="/stats tiles" note="Not a price feed. Implied take uses the 1% schedule, not hook tax.">
          <div className="docs-stat-tiles">
            <article>
              <small>Volume</small>
              <strong>24h / 7d / 30d</strong>
            </article>
            <article>
              <small>Protocol take</small>
              <strong>V · 1%</strong>
            </article>
            <article>
              <small>$HKT drop</small>
              <strong>V · 1% · 10%</strong>
            </article>
            <article>
              <small>Buyback</small>
              <strong>Burned $HKT</strong>
            </article>
          </div>
        </Figure>
      );
    case "integration":
      return (
        <Figure caption="Same-origin indexer">
          <ol className="docs-stack">
            <li>
              <span>/health</span>
              <p>Cursor, lag, last poll error</p>
            </li>
            <li>
              <span>/v1/tokens</span>
              <p>Catalog + markets[] + 24h windows</p>
            </li>
            <li>
              <span>/trades · /candles</span>
              <p>House tape. 5m default, 1m available</p>
            </li>
          </ol>
        </Figure>
      );
    case "network":
      return (
        <Figure caption="Production chain">
          <div className="docs-network">
            <div>
              <small>Chain</small>
              <strong>Ink · 57073</strong>
            </div>
            <div>
              <small>Gas</small>
              <strong>ETH</strong>
            </div>
            <div>
              <small>Quotes</small>
              <strong>ETH · USDG · wStocks</strong>
            </div>
          </div>
        </Figure>
      );
    case "contracts":
      return (
        <Figure caption="Read vaults from the live hook" note="UI hardcodes factories. Vault addresses come from floorVault(), feeEscrow(), hktDropVault(), …">
          <div className="docs-math-index">
            {["LaunchFactory", "BondingFactory", "SwapRouter", "Distributor", "HkitBuyback", "PoolManager"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </Figure>
      );
    case "events":
      return (
        <Figure caption="Index these logs">
          <ol className="docs-stack">
            <li>
              <span>Launch</span>
              <p>TokenLaunched · MarketLaunched · Graduated</p>
            </li>
            <li>
              <span>Trade</span>
              <p>PoolManager.Swap · Bought / Sold</p>
            </li>
            <li>
              <span>Flywheel</span>
              <p>HktHolderDropVault.Dropped · BuybackBurned</p>
            </li>
          </ol>
        </Figure>
      );
    case "reading":
      return (
        <Figure caption="Two packed integers">
          <div className="docs-three">
            <article>
              <h4>launchId</h4>
              <p>Token, pool, creator, quote.</p>
            </article>
            <article>
              <h4>bitmask</h4>
              <p>Modules + tax + caps.</p>
            </article>
            <article>
              <h4>vestPacked</h4>
              <p>Buyback plan · airdrop plan.</p>
            </article>
          </div>
        </Figure>
      );
    case "pricing":
      return (
        <Figure caption="Spot → FDV">
          <Flow
            nodes={[
              { t: "sqrtPriceX96", d: "StateView.getSlot0" },
              { t: "P quote/token", d: "(√P / 2⁹⁶)²" },
              { t: "× 1B", d: "Fixed supply" },
              { t: "× FX", d: "ETH/USD or wStock/USDG" },
            ]}
          />
        </Figure>
      );
    case "risks":
      return (
        <Figure caption="Assume the worst print">
          <div className="docs-three">
            <article>
              <h4>Zero</h4>
              <p>Most tickers go to nothing.</p>
            </article>
            <article>
              <h4>Copycats</h4>
              <p>Verify the contract every time.</p>
            </article>
            <article>
              <h4>Thin book</h4>
              <p>Printed price is not an exit.</p>
            </article>
          </div>
        </Figure>
      );
    case "support":
      return (
        <Figure caption="Where to file">
          <p className="docs-support-link">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              {GITHUB_REPO_URL.replace("https://", "")}
            </a>
            <small>Chain · token · tx hash · wallet. No SLA.</small>
          </p>
        </Figure>
      );
    case "terms":
      return (
        <Figure caption="Software only">
          <div className="docs-three">
            <article>
              <h4>No custody</h4>
              <p>The site never holds keys.</p>
            </article>
            <article>
              <h4>No advice</h4>
              <p>Not a listing or a vet.</p>
            </article>
            <article>
              <h4>No refunds</h4>
              <p>Launch fee and gas stay spent.</p>
            </article>
          </div>
        </Figure>
      );
    default:
      return null;
  }
}
