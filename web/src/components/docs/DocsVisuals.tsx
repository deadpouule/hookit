import type { ReactNode } from "react";

import { PoweredByQuotronsBadge } from "@/components/brand/PoweredByQuotronsBadge";
import { DocsFork } from "@/components/docs/DocsBranchGraph";
import { DocsLaunchSteps } from "@/components/docs/DocsLaunchSteps";
import { MasterHookGlyph, MultiPairGlyph } from "@/components/home/market/CategoryGlyphs";
import { HeroHookTotem } from "@/components/home/market/HeroHookTotem";
import { HookLogo } from "@/components/home/market/HookLogo";
import { PairingMark } from "@/components/launch/PairingMark";
import type { DocsVisualId } from "@/lib/docs-content";
import type { BrowseHookId, HookTheme } from "@/lib/master-hooks";
import { PAIRING_TOKENS, type PairingTokenId } from "@/lib/pairing-tokens";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

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

function Pipe({
  caption,
  note,
  nodes,
}: {
  caption: string;
  note?: string;
  nodes: { t: string; d?: string }[];
}) {
  return (
    <Figure caption={caption} note={note}>
      <ol className="docs-pipe">
        {nodes.map((node, i) => (
          <li key={node.t}>
            <div className="docs-pipe-box">
              <strong>{node.t}</strong>
              {node.d ? <p>{node.d}</p> : null}
            </div>
            {i < nodes.length-1 ? (
              <span className="docs-pipe-arrow" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Figure>
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
  labels: {
    x: number;
    y: number;
    text?: string;
    parts?: string[];
    anchor?: "start" | "middle" | "end";
  }[];
}) {
  return (
    <svg className="docs-spark" viewBox="0 0 360 120" role="img">
      <path d={d} fill={fill} />
      <path d={d.replace(/Z$/, "")} fill="none" stroke={stroke} strokeWidth="2.2" />
      {labels.map((label) => {
        const parts = label.parts?.length ? label.parts : [label.text ?? ""];
        return (
          <text
            key={parts.join("|")}
            className="docs-spark-label"
            x={label.x}
            y={label.y}
            textAnchor={label.anchor ?? "start"}
          >
            {parts.map((part, i) => (
              <tspan key={`${part}-${i}`} dx={i === 0 ? undefined : 10}>
                {part}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

function Example({
  title,
  rows,
}: {
  title: string;
  rows: { k: string; v: string }[];
}) {
  return (
    <div className="docs-example">
      <p className="docs-example-title">{title}</p>
      <dl>
        {rows.map((row) => (
          <div key={row.k}>
            <dt>{row.k}</dt>
            <dd>{row.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DocsVisual({ id }: { id: DocsVisualId }) {
  switch (id) {
    case "wizard":
      return <DocsLaunchSteps />;
    case "creator-flow":
      return null;
    case "classic-quotes":
      return (
        <figure className="docs-schema">
          <figcaption>Classic quote pairs</figcaption>
          <ul className="docs-classic-quotes">
            {PAIRING_TOKENS.map((token) => (
              <li key={token.id}>
                <PairingMark id={token.id} size="sm" />
              </li>
            ))}
          </ul>
        </figure>
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
                Multi-pair
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
    case "master-studio":
      return (
        <Figure
          caption="Master Launch Studio"
          note="Same screens as /launch. Pick Master, then Token & pair."
        >
          <div className="docs-studio-shots">
            <div className="docs-studio-shot">
              <p className="docs-studio-shot-label">Choose a launch model</p>
              <div className="launch-model-card docs-studio-model">
                <div className="docs-rail-stage launch-model-stage">
                  <HeroHookTotem interactive={false} />
                </div>
                <div className="launch-model-copy">
                  <h4 className="terminal-title">Master.</h4>
                  <p>
                    Pool from block 0. Launch your programmable hooks with our modules: floor, burn, vesting
                    <span aria-hidden>→</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="docs-studio-shot">
              <p className="docs-studio-shot-label">Token & pair</p>
              <div className="docs-wizard-shot" aria-hidden>
                <div className="docs-wizard-shot-head">
                  <span className="token-type-badge token-type-badge--master token-hooks-count-badge launch-wizard-master-badge">
                    <MasterHookGlyph className="token-type-badge-glyph" />
                    Master launch
                  </span>
                  <strong>Create a hooked token</strong>
                  <div className="docs-wizard-shot-dots">
                    <i className="is-on" />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <span>1 / 6 Token & pair</span>
                  </div>
                </div>
                <p className="docs-wizard-shot-h">Token details</p>
                <div className="docs-wizard-shot-form">
                  <div className="docs-wizard-shot-logo">Logo</div>
                  <div className="docs-wizard-shot-fields">
                    <label>
                      Name
                      <span>My Token</span>
                    </label>
                    <label>
                      Symbol
                      <span>TKN</span>
                    </label>
                  </div>
                </div>
                <div className="docs-wizard-shot-pair">
                  <PairingMark id="eth" size="sm" />
                  <span>Pair · ETH</span>
                </div>
              </div>
            </div>
          </div>
        </Figure>
      );
    case "arb-keeper":
      return (
        <Figure
          caption="Arb keeper closes the USD gap"
          note="Buys the cheap USD leg and sells the rich one in one unlock."
        >
          <svg className="docs-spark" viewBox="0 0 360 168" role="img" aria-label="Arb keeper buys the cheap pool and sells the rich one">
            <rect x="12" y="28" width="104" height="64" rx="12" fill="#111" stroke="rgb(56 189 248 / 0.45)" />
            <text x="64" y="54" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="700">
              ETH pool
            </text>
            <text x="64" y="72" textAnchor="middle" fill="#a1a1aa" fontSize="9">
              cheap USD
            </text>
            <rect x="128" y="28" width="104" height="64" rx="12" fill="rgb(149 20 209 / 0.14)" stroke="rgb(149 20 209 / 0.5)" />
            <text x="180" y="54" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
              Keeper
            </text>
            <text x="180" y="72" textAnchor="middle" fill="#c4b5fd" fontSize="8">
              one unlock
            </text>
            <rect x="244" y="28" width="104" height="64" rx="12" fill="#111" stroke="rgb(244 63 94 / 0.45)" />
            <text x="296" y="54" textAnchor="middle" fill="#fb7185" fontSize="12" fontWeight="700">
              wNVDA pool
            </text>
            <text x="296" y="72" textAnchor="middle" fill="#a1a1aa" fontSize="9">
              rich USD
            </text>
            <path d="M116 60 L128 60" stroke="#7dd3fc" strokeWidth="1.6" />
            <path d="M232 60 L244 60" stroke="#fb7185" strokeWidth="1.6" />
            <text x="122" y="52" fill="#7dd3fc" fontSize="8">
              buy
            </text>
            <text x="238" y="52" textAnchor="end" fill="#fb7185" fontSize="8">
              sell
            </text>
            <text x="180" y="136" textAnchor="middle" fill="#a1a1aa" fontSize="10">
              Buy cheap tokens, sell the rich leg.
            </text>
            <text x="180" y="152" textAnchor="middle" fill="#71717a" fontSize="9">
              Min 10% USD gap. Clip 0.50% of supply.
            </text>
          </svg>
          <Example
            title="Example"
            rows={[
              { k: "Gap", v: "ETH leg 10% cheaper in USD than the wNVDA leg." },
              { k: "Clip", v: "Keeper buys ETH-quoted tokens, sells into wNVDA, max 0.50% of supply." },
              { k: "Unlock", v: "One keeper tx closes the gap across the token's quote markets." },
            ]}
          />
        </Figure>
      );
    case "quotrons":
      return (
        <Figure
          caption="Launch against wrapped equities"
          note="wStock pools take USDG on the buy panel. HookitSwapRouter bridges on an allowed Quotrons pool."
        >
          <div className="docs-quotrons">
            <PoweredByQuotronsBadge variant="compact" className="docs-quotrons-badge" />
            <div className="docs-quotrons-list">
              {INK_QUOTRON_STOCKS.map((stock) => (
                <div key={stock.symbol} className="docs-quotrons-stock">
                  <PairingMark id={stock.symbol.toLowerCase() as PairingTokenId} size="sm" />
                  <strong>{stock.symbol}</strong>
                  <span>{stock.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Figure>
      );
    case "trading":
      return (
        <Pipe
          caption="Hooked swap path"
          nodes={[
            { t: "Wallet", d: "Sign buy or sell" },
            { t: "HookitSwapRouter", d: "Keeps hook accounting" },
            { t: "v4 pool", d: "1% quote fee" },
            { t: "MasterLaunchHook", d: "Quote fee → 60 / 10 / 30" },
          ]}
        />
      );
    case "router":
      return (
        <Figure
          caption="Why the hookit router"
          note="Generic DEX UIs can skip hook accounting or revert."
        >
          <div className="docs-router">
            <div className="docs-router-row docs-router-row--bad">
              <span>Wallet</span>
              <i aria-hidden>→</i>
              <span>Generic DEX</span>
              <i aria-hidden>→</i>
              <strong>Skip / revert</strong>
            </div>
            <div className="docs-router-row docs-router-row--ok">
              <span>Wallet</span>
              <i aria-hidden>→</i>
              <span>HookitSwapRouter</span>
              <i aria-hidden>→</i>
              <strong>Fees + modules</strong>
            </div>
          </div>
        </Figure>
      );
    case "creator-fees":
      return (
        <DocsFork
          caption="Where the creator 60% sits"
          kicker="Every trade"
          sources={[
            { t: "1% base", d: "Quote only. Always on." },
            { t: "Anti-Snipe take", d: "Same 60 / 10 / 30. Temporary." },
          ]}
          hub={{ t: "Creator 60%", d: "Packed at launch. One stream." }}
          outputs={[
            { t: "FeeEscrow", d: "Default. Claim quote on the token page." },
            { t: "BuybackVault", d: "If vesting is on. Clock or FDV unlock." },
            { t: "Hook pot", d: "If Creator → Hook. No creator claim." },
          ]}
          note="The 10% $HKT drop and 30% protocol cut never go to the creator."
        />
      );
    case "anti-snipe-decay":
      return (
        <Figure caption="Snipe tax decays to zero" note="Buy-only. Same 60 / 10 / 30 split as the 1% base, not hook tax.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="anti-snipe" theme="fire" />
            <Spark
              d="M16 24 L16 24 L40 28 C 80 34, 140 54, 210 82 C 260 98, 310 108, 344 110 L 344 110 L 16 110 Z"
              fill="rgb(255 0 80 / 0.18)"
              stroke="#ff0050"
              labels={[
                { x: 16, y: 16, parts: ["t=0", "98%"] },
                { x: 344, y: 94, parts: ["t=5s", "0%"], anchor: "end" },
              ]}
            />
          </div>
          <Example
            title="Example: 1 ETH buy, 5s window, 98% open tax"
            rows={[
              { k: "First second", v: "+0.98 ETH snipe on top of the 1% base. Sniper pays ~1.99 ETH in." },
              { k: "After 5s", v: "Snipe is 0. Same 1 ETH buy pays only 0.01 ETH base." },
              { k: "Where the 0.98 goes", v: "60% creator · 10% $HKT drop · 30% protocol." },
            ]}
          />
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
                <strong>tx.origin A, buy</strong>
                <small>Allowed</small>
              </div>
              <div className="docs-mev-no">
                <span>Same block</span>
                <strong>tx.origin A, sell</strong>
                <small>SandwichBlocked</small>
              </div>
            </div>
          </div>
          <Example
            title="Example: Alice in one block"
            rows={[
              { k: "Block 100, buy 1 ETH", v: "Allowed." },
              { k: "Block 100, sell", v: "Reverts SandwichBlocked." },
              { k: "Block 101, sell", v: "Allowed. Next block, new lock." },
            ]}
          />
        </Figure>
      );
    case "max-tx":
      return (
        <Figure caption="Single-swap supply cap" note="0.1%–2.5% of supply. Oversized exact-input reverts.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="max-tx" theme="lime" />
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
          <Example
            title="Example: 1B supply, 1% max tx = 10M tokens"
            rows={[
              { k: "Buy 8M tokens", v: "Goes through." },
              { k: "Buy 12M tokens", v: "Reverts. One swap cannot eat more than the cap." },
            ]}
          />
        </Figure>
      );
    case "deepen-lps":
      return (
        <Figure
          caption="The book gets thicker"
          note="Hook-tax quote is minted back into the same launch ticks. Not paid to holders."
        >
          <div className="docs-deepen-waves">
              <div className="docs-deepen-col">
                <span>At launch</span>
                <HookLogo hookId="deepen-lps" theme="nature" className="docs-deepen-logo docs-deepen-logo--thin" />
                <small>Thin waves</small>
              </div>
              <span className="docs-deepen-arrow" aria-hidden>
                →
              </span>
              <div className="docs-deepen-col">
                <span>After volume</span>
                <HookLogo hookId="deepen-lps" theme="nature" className="docs-deepen-logo docs-deepen-logo--deep" />
                <small>Deeper, larger</small>
              </div>
            </div>
          <Example
            title="Example: 2% hook tax, 100% to Deepen LPs"
            rows={[
              { k: "1 ETH buy", v: "0.02 ETH minted into the LP after the swap." },
              { k: "50 such buys", v: "+1 ETH of depth in the launch range." },
              { k: "100 such buys", v: "+2 ETH. Same size walk moves price less." },
            ]}
          />
        </Figure>
      );
    case "auto-burn":
      return (
        <Figure
          caption="Supply burns down"
          note="Hook tax buys the meme from its own pool and sends it to the dead address. Not the $HKT buyback."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="auto-burn" theme="crimson" />
            <Spark
              d="M16 22 C 80 26, 140 38, 200 62 C 250 82, 300 98, 344 108 L 344 118 L 16 118 Z"
              fill="rgb(220 38 38 / 0.18)"
              stroke="#dc2626"
              labels={[
                { x: 16, y: 16, text: "1B at launch" },
                { x: 236, y: 100, text: "After burns", anchor: "middle" },
              ]}
            />
          </div>
          <Example
            title="Example: 2% hook tax, 80% to Auto-Burn"
            rows={[
              { k: "1 ETH buy", v: "0.016 ETH buys the token and burns it." },
              { k: "$100k volume", v: "~$1.6k of token bought and burned." },
              { k: "$1M volume", v: "~$16k burned. Circulating supply is lower, FDV math uses what's left." },
            ]}
          />
        </Figure>
      );
    case "buyback-vesting":
      return (
        <Figure
          caption="Creator 60% unlocks later"
          note="Cannot combine with Creator → Hook. The 10% $HKT drop stays mandatory."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="buyback-vesting" theme="void" />
            <div className="docs-vest-charts">
              <svg className="docs-spark" viewBox="0 0 170 120" role="img" aria-label="Linear unlock over 30 days">
                <text x="8" y="14" fill="#a1a1aa" fontSize="10">
                  Time vest
                </text>
                <path d="M16 100 L154 28" fill="none" stroke="#e879f9" strokeWidth="2.2" />
                <path d="M16 100 L154 28 L154 108 L16 108 Z" fill="rgb(232 121 249 / 0.14)" />
                <text x="16" y="118" fill="#52525b" fontSize="9">
                  day 0
                </text>
                <text x="118" y="118" fill="#52525b" fontSize="9">
                  day 30
                </text>
              </svg>
              <svg className="docs-spark" viewBox="0 0 170 120" role="img" aria-label="Cliff unlock at 10 million FDV">
                <text x="8" y="14" fill="#a1a1aa" fontSize="10">
                  Until FDV
                </text>
                <path d="M16 100 L88 100 L88 28 L154 28" fill="none" stroke="#e879f9" strokeWidth="2.2" />
                <path d="M16 100 L88 100 L88 28 L154 28 L154 108 L16 108 Z" fill="rgb(232 121 249 / 0.14)" />
                <text x="16" y="118" fill="#52525b" fontSize="9">
                  $0
                </text>
                <text x="78" y="22" fill="#e879f9" fontSize="9">
                  $10M
                </text>
              </svg>
            </div>
          </div>
          <Example
            title="Example: $100k volume, 60% of the 1% base = $600 locked"
            rows={[
              { k: "30-day vest, day 15", v: "$300 claimable. Linear. Dump later does not relock it." },
              { k: "Until $10M FDV", v: "$0 until mcap prints $10M, then the full $600." },
              { k: "By % rungs", v: "e.g. 25% at $10M, 25% at $50M, 50% at $100M." },
              { k: "Plus Fixed 2%", v: "$2,000 more locked in the same vault. Not FeeEscrow." },
            ]}
          />
        </Figure>
      );
    case "holder-airdrop":
      return (
        <Figure
          caption="Quote split to holders of that token"
          note="Optional module. Not the mandatory $HKT drop. You receive ETH / USDG / wStock, not the meme."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="holder-airdrop" theme="gold" />
            <svg className="docs-spark" viewBox="0 0 360 130" role="img" aria-label="Vault pot split pro-rata to token holders">
              <rect x="16" y="36" width="72" height="72" rx="12" fill="rgb(245 158 11 / 0.16)" stroke="#f59e0b" />
              <text x="52" y="70" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="700">
                pot
              </text>
              <text x="52" y="86" textAnchor="middle" fill="#a1a1aa" fontSize="9">
                0.01 ETH
              </text>
              <path d="M96 72 L132 72" stroke="#71717a" strokeWidth="1.3" />
              {[
                { x: 168, h: 64, l: "you 2%" },
                { x: 216, h: 40, l: "2%" },
                { x: 264, h: 28, l: "1%" },
                { x: 312, h: 18, l: "…" },
              ].map((bar) => (
                <g key={bar.x}>
                  <rect x={bar.x} y={108-bar.h} width="28" height={bar.h} rx="5" fill="rgb(245 158 11 / 0.35)" />
                  <text x={bar.x + 14} y="122" textAnchor="middle" fill="#71717a" fontSize="8">
                    {bar.l}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <Example
            title="Example: 2% hook tax, 50% to airdrop, you hold 2% of supply"
            rows={[
              { k: "1 ETH buy", v: "0.01 ETH into the vault this swap." },
              { k: "Your payout", v: "2% × 0.01 = 0.0002 ETH when the epoch pushes." },
              { k: "$100k volume", v: "~$20 to you in quote. Not $HKT, the launched token's holders." },
            ]}
          />
        </Figure>
      );
    case "hook-to-creator":
      return (
        <Figure
          caption="Hook tax paid to the creator"
          note="Alone it is 100%. Split with burn, floor, Deepen LPs, or airdrop so shares still add to 100%."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="hook-to-creator" theme="crimson" />
            <div className="docs-split-bar" role="img" aria-label="Hook pot split 50 percent burn 50 percent creator">
              <div className="docs-split-seg" style={{ flex: 50, background: "#dc2626", color: "#fff" }}>
                <span>50%</span>
                <small>Auto-Burn</small>
              </div>
              <div className="docs-split-seg" style={{ flex: 50, background: "#ef4444", color: "#fff" }}>
                <span>50%</span>
                <small>→ Creator</small>
              </div>
            </div>
          </div>
          <Example
            title="Example: 1 ETH buy, 2% hook tax"
            rows={[
              { k: "Hook → Creator 100%", v: "0.020 ETH tax to creator escrow, plus 0.006 ETH from the 1% base." },
              { k: "Burn 50% + Creator 50%", v: "0.010 ETH burn buyback and 0.010 ETH to the creator." },
            ]}
          />
        </Figure>
      );
    case "creator-share":
      return (
        <Figure caption="Creator 60% feeds the hook pot" note="Nothing to claim as creator fees. $HKT 10% is untouched.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="creator-share-to-hook" theme="yellow" />
            <div className="docs-split-bar" role="img" aria-label="Creator 60 percent redirected into the hook pot">
              <div className="docs-split-seg" style={{ flex: 60, background: "#facc15", color: "#111" }}>
                <span>60%</span>
                <small>→ hook pot</small>
              </div>
              <div className="docs-split-seg docs-split-seg--hkt" style={{ flex: 10 }}>
                <span>10%</span>
                <small>$HKT</small>
              </div>
              <div className="docs-split-seg docs-split-seg--proto" style={{ flex: 30 }}>
                <span>30%</span>
                <small>Protocol</small>
              </div>
            </div>
          </div>
          <Example
            title="Example: 1 ETH buy, no hook tax, Creator → Hook on"
            rows={[
              { k: "Base 1%", v: "0.006 ETH to Hook → Creator / floor / burn / deepen / airdrop instead of escrow." },
              { k: "$100k volume", v: "$600 extra in the pot. Creator claims $0." },
            ]}
          />
        </Figure>
      );
    case "fixed-fees":
      return (
        <Figure caption="Flat extra hook tax" note="Mutually exclusive with Dynamic Fees. 1% + tax ≤ 10%.">
          <div className="docs-visual-hook-row">
            <HookMark hookId="fixed-fee" theme="cobalt" />
            <div className="docs-fee-bars">
              <div>
                <span>Base 1%, every swap</span>
                <b style={{ width: "20%" }} />
              </div>
              <div>
                <span>Hook tax 2%, every swap</span>
                <b className="is-tax" style={{ width: "40%" }} />
              </div>
            </div>
          </div>
          <Example
            title="Example: 2% fixed hook tax"
            rows={[
              { k: "1 ETH buy", v: "Pays 1 ETH. Receives 0.97 ETH worth of tokens (0.01 base + 0.02 hook tax)." },
              { k: "10 × 1 ETH buys", v: "0.10 ETH base (60/10/30) + 0.20 ETH into the hook pot." },
              { k: "$1M volume", v: "$10k base + $20k hook tax. Tax needs a 100% destination (Hook → Creator, burn, floor, Deepen LPs, or airdrop)." },
            ]}
          />
        </Figure>
      );
    case "dynamic-fees":
      return (
        <Figure
          caption="Tax ramps with depth eaten"
          note="Same orange as the hook. No oracle. Empty book stays at τ_min so the first buy does not revert."
        >
          <div className="docs-visual-hook-row">
            <HookMark hookId="dynamic-fees" theme="ember" />
            <Spark
              d="M16 96 L16 96 C 70 94, 120 88, 170 70 C 230 48, 280 28, 344 18 L 344 110 L 16 110 Z"
              fill="rgb(255 77 0 / 0.2)"
              stroke="#ff4d00"
              labels={[
                { x: 16, y: 88, text: "τ_min 1%" },
                { x: 288, y: 16, text: "τ_max 9%" },
              ]}
            />
          </div>
          <Example
            title="Example: 10 ETH in-range depth, extra tax 1% → 9%"
            rows={[
              { k: "Retail 0.2 ETH", v: "Uses 2% of the book. Extra ≈ 1.16%. Pays ~0.002 ETH hook tax + 0.002 ETH base." },
              { k: "Whale 5 ETH", v: "Uses 50% of the book. Extra = 5%. Pays 0.25 ETH hook tax + 0.05 ETH base." },
              { k: "Clip the whole book", v: "Extra = 9%. A 10 ETH buy pays 0.90 ETH hook tax + 0.10 ETH base." },
            ]}
          />
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
    case "integration":
      return (
        <Figure caption="Same-origin indexer">
          <ol className="docs-stack">
            <li>
              <span>/health</span>
              <p>Head, lag, last poll error</p>
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
        <Pipe
          caption="Spot to FDV"
          note="Classic on the curve uses virtual reserves instead of sqrtPriceX96."
          nodes={[
            { t: "sqrtPriceX96", d: "StateView.getSlot0" },
            { t: "P quote / token", d: "(√P / 2⁹⁶)²" },
            { t: "× 1B", d: "Fixed supply" },
            { t: "× FX", d: "ETH/USD or wStock" },
            { t: "FDV", d: "USD print" },
          ]}
        />
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
