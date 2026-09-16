import {
  DocsFeeFlow,
  DocsFork,
  DocsPipe,
  DocsPointArrow,
  DocsWheel,
} from "@/components/docs/DocsBranchGraph";
import { AnimatedGridBackground } from "@/components/home/market/AnimatedGridBackground";
import { HeroHookTotem } from "@/components/home/market/HeroHookTotem";
import { HookLogo } from "@/components/home/market/HookLogo";
import { ClassicAsciiCoin } from "@/components/launch/LaunchModelPicker";
import type { DocsDiagramId } from "@/lib/docs-content";
import {
  EXPLORE_HOOKS,
  MASTER_HOOK_FILTERS,
  type BrowseHookId,
  type MasterHookCategory,
} from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

export function DocsHookHeading({
  hookId,
  as: Tag = "h3",
}: {
  hookId: BrowseHookId;
  as?: "h2" | "h3";
}) {
  const hook = EXPLORE_HOOKS.find((item) => item.id === hookId);
  if (!hook) return null;
  return (
    <Tag className={cn("docs-hook-heading", `orb-hook-title-plain orb-hook-desc-badge--${hook.theme}`)}>
      <HookLogo hookId={hook.id} theme={hook.theme} className="docs-hook-heading-logo" />
      {hook.title}
    </Tag>
  );
}

export function DocsDiagram({ id }: { id: DocsDiagramId }) {
  switch (id) {
    case "rails":
      return <RailsDiagram />;
    case "overview-cycle":
      return <OverviewCycleDiagram />;
    case "stack":
      return <StackDiagram />;
    case "flywheel":
      return <FlywheelDiagram />;
    case "fee-split":
      return <FeeSplitDiagram />;
    case "swap-lifecycle":
      return <SwapLifecycleDiagram />;
    case "classic-curve":
      return <ClassicCurveDiagram />;
    case "floor-loop":
      return <FloorLoopDiagram />;
    case "hkt-loop":
      return <HktLoopDiagram />;
    case "hkt-burn":
      return <HktBurnDiagram />;
    case "quotrons-flywheel":
      return <QuotronsFlywheelDiagram />;
    case "quotrons-fees":
      return <QuotronsFeesDiagram />;
    default:
      return null;
  }
}

export function DocsHookCatalog() {
  const groups = MASTER_HOOK_FILTERS.filter((filter) => filter.id !== "all") as {
    id: MasterHookCategory;
    label: string;
  }[];

  return (
    <div className="docs-hook-catalog">
      {groups.map((group) => {
        const hooks = EXPLORE_HOOKS.filter((hook) => hook.category === group.id);
        if (hooks.length === 0) return null;
        return (
          <div key={group.id} className="docs-hook-group">
            <p className="docs-hook-group-label">{group.label}</p>
            <div className="docs-hook-grid">
              {hooks.map((hook) => (
                <article key={hook.id} className={cn("docs-hook-tile", `orb-card--${hook.theme}`)}>
                  <HookLogo hookId={hook.id} theme={hook.theme} className="docs-hook-logo" />
                  <div>
                    <h4 className={cn("orb-hook-title-plain", `orb-hook-desc-badge--${hook.theme}`)}>{hook.title}</h4>
                    <p>{hook.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RailsDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>Two launch rails</figcaption>
      <div className="docs-rails docs-rails--ui">
        <div className="launch-model-card docs-rail docs-rail--master">
          <p className="docs-rail-kicker">Master</p>
          <div className="docs-rail-stage launch-model-stage">
            <HeroHookTotem interactive={false} />
          </div>
          <div className="launch-model-copy">
            <h4 className="terminal-title">Master.</h4>
            <p>Pool from block 0. Launch your programmable hooks with our modules: floor, burn, vesting →</p>
          </div>
        </div>
        <div className="docs-rail-vs" aria-hidden>
          or
        </div>
        <div className="launch-model-card docs-rail docs-rail--classic">
          <p className="docs-rail-kicker">Classic</p>
          <div className="docs-rail-stage launch-model-stage">
            <AnimatedGridBackground className="launch-model-grid-bg" />
            <ClassicAsciiCoin />
          </div>
          <div className="launch-model-copy">
            <h4 className="terminal-title">Classic.</h4>
            <p>Bond, then graduate at 4.2 ETH-eq.</p>
          </div>
        </div>
      </div>
    </figure>
  );
}

function OverviewCycleDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>Every swap feeds $HKT</figcaption>
      <p className="docs-map-kicker">Connected fee cycle</p>
      <div className="docs-dapp-map" role="img" aria-label="Every swap on hookit feeds $HKT holders">
        <div className="docs-dapp-map-shares">
          <p>Share of the 1% base</p>
          <span className="is-creator">
            <strong>60%</strong>
            Creator
          </span>
          <span className="is-hkt">
            <strong>10%</strong>
            $HKT
          </span>
          <span className="is-proto">
            <strong>30%</strong>
            Protocol
          </span>
        </div>
        <div className="docs-dapp-map-body">
          <div className="docs-dapp-map-col">
            <article>
              <strong>Master launches</strong>
              <span>Pool from block 0.</span>
            </article>
            <article>
              <strong>Graduated Classic</strong>
              <span>After 4.2 ETH-eq.</span>
            </article>
            <article>
              <strong>Any quote pair</strong>
              <span>ETH, USDG, wStock.</span>
            </article>
          </div>
          <div className="docs-dapp-map-join">
            <DocsPointArrow />
          </div>
          <div className="docs-dapp-map-take">
            <article className="docs-dapp-map-pct">
              <strong>1%</strong>
              <span>Quote-only fee. Never the memecoin.</span>
            </article>
            <DocsPointArrow down />
            <article className="docs-dapp-map-hub">
              <img src="/brand/hookit-owl-favicon.png" alt="" />
              <strong>MasterLaunchHook</strong>
              <span>One take. Shares packed at launch.</span>
            </article>
          </div>
          <div className="docs-dapp-map-join">
            <DocsPointArrow />
          </div>
          <div className="docs-dapp-map-streams">
            <div className="docs-dapp-map-stream">
              <article>
                <strong>Creator 60%</strong>
                <span>Escrow, vest, or hook pot.</span>
              </article>
              <DocsPointArrow />
              <article>
                <strong>Claim or recycle</strong>
                <span>Creator fees never touch the 10% drop.</span>
              </article>
            </div>
            <div className="docs-dapp-map-stream is-hkt">
              <article>
                <strong>$HKT drop 10%</strong>
                <span>Buys that pool's ticker.</span>
              </article>
              <DocsPointArrow />
              <article>
                <strong>Epoch to holders</strong>
                <span>Live $HKT balances. Hold one, get all.</span>
              </article>
            </div>
            <div className="docs-dapp-map-stream">
              <article>
                <strong>Protocol 30%</strong>
                <span>20% ops. 80% buys $HKT.</span>
              </article>
              <DocsPointArrow />
              <article>
                <strong>Buy and burn</strong>
                <span>Protocol buyback burns $HKT.</span>
              </article>
            </div>
          </div>
        </div>
        <div className="docs-dapp-map-tax">
          <article>
            <strong>Hook tax</strong>
            <span>Optional Master extra, 0 to 9%.</span>
          </article>
          <DocsPointArrow />
          <article>
            <strong>Hook pot</strong>
            <span>Auto-Burn, Floor, Deepen LPs, Airdrop.</span>
          </article>
        </div>
      </div>
      <p className="docs-schema-note">
        Hook tax skips the 60 / 10 / 30. It fills the pot, then modules spend it. The 10% $HKT
        slice cannot be removed.
      </p>
    </figure>
  );
}

function StackDiagram() {
  const layers = [
    { k: "App", v: "hookit.fun: marketplace, launch wizard, token desk" },
    { k: "Router", v: "HookitSwapRouter: hooked swaps, composite quote legs" },
    { k: "Hook", v: "MasterLaunchHook / GraduatedFeeHook: quote-only fees + modules" },
    { k: "Pool", v: "Uniswap v4 PoolManager: fee tier 0, locked liquidity" },
    { k: "Ink", v: "Chain 57073. ETH gas, USDG + Quotrons wStocks as quotes" },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Protocol stack</figcaption>
      <ol className="docs-stack">
        {layers.map((layer) => (
          <li key={layer.k}>
            <span>{layer.k}</span>
            <p>{layer.v}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function FlywheelDiagram() {
  return (
    <DocsFeeFlow
      caption="Where the 1% goes"
      kicker="Every swap"
      source={{ t: "Any swap", d: "Quote-only 1%. Never the memecoin." }}
      hub={{ t: "MasterLaunchHook", d: "One take. Shares packed at launch." }}
      outputs={[
        { t: "Creator 60%", d: "FeeEscrow, Buyback Vesting, or Creator → Hook." },
        { t: "$HKT drop 10%", d: "Buys that pool's ticker for live $HKT holders." },
        { t: "Protocol 30%", d: "20% ops. 80% buys $HKT and burns it." },
        { t: "Hook pot", d: "Optional tax. Burn, floor, deepen, airdrop." },
      ]}
      note="The 1% always splits 60 / 10 / 30. Hook tax never uses that split. It fills the pot, then modules."
    />
  );
}

function FeeSplitDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>1% base fee, 60 / 10 / 30</figcaption>
      <div className="docs-split-bar" role="img" aria-label="Creator 60 percent, HKT holders 10 percent, protocol 30 percent">
        <div className="docs-split-seg docs-split-seg--creator" style={{ flex: 60 }}>
          <span>60%</span>
          <small>Creator</small>
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
      <dl className="docs-split-legend">
        <div>
          <dt>Creator 60%</dt>
          <dd>FeeEscrow, BuybackVault if vesting is on, or the hook pot if Creator → Hook is on.</dd>
        </div>
        <div>
          <dt>$HKT 10%</dt>
          <dd>Buys the launched token and epoch-pushes it pro-rata to live $HKT holders.</dd>
        </div>
        <div>
          <dt>Protocol 30%</dt>
          <dd>Then 20% ops / 80% native-token buyback. Unallocated hook tax joins this pot.</dd>
        </div>
      </dl>
    </figure>
  );
}

function SwapLifecycleDiagram() {
  return (
    <DocsPipe
      caption="Master swap lifecycle"
      kicker="One unlock"
      steps={[
        { t: "beforeSwap", d: "Anti-MEV, Anti-Snipe, Max Tx." },
        { t: "Take quote", d: "1% base plus hook tax. Quote leg only." },
        { t: "Split", d: "60 / 10 / 30 on the 1%. Tax into the pot." },
        { t: "afterSwap", d: "Auto-Burn, Deepen LPs, floor credit, airdrop accrue." },
      ]}
      note="Fee is never a memecoin tax. Modules spend the pot in afterSwap. The 1% split never changes."
    />
  );
}

function ClassicCurveDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>Classic bonding → graduation</figcaption>
      <div className="docs-curve">
        <svg viewBox="0 0 360 120" role="img" aria-label="Bonding curve filling then graduating into a Uniswap pool">
          <path
            d="M16 104 C 70 100, 110 86, 150 64 C 190 42, 230 28, 286 18"
            fill="none"
            stroke="#9514d1"
            strokeWidth="2.4"
          />
          <path
            d="M16 104 C 70 100, 110 86, 150 64 C 190 42, 230 28, 286 18 L 286 104 Z"
            fill="rgb(149 20 209 / 0.16)"
          />
          <line x1="286" y1="12" x2="286" y2="108" stroke="#e4e4e7" strokeDasharray="3 4" strokeWidth="1.2" />
          <text x="16" y="16" fill="#71717a" fontSize="10">
            price
          </text>
          <text x="292" y="22" fill="#e4e4e7" fontSize="10">
            4.2 ETH-eq
          </text>
          <text x="16" y="118" fill="#52525b" fontSize="10">
            tokens sold (80%)
          </text>
        </svg>
        <p className="docs-schema-note">
          Virtual constant-product. 20% of supply is reserved for full-range LP at graduation.
        </p>
      </div>
    </figure>
  );
}

function FloorLoopDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>Floor only ratchets up</figcaption>
      <svg className="docs-spark" viewBox="0 0 360 120" role="img" aria-label="Floor price stepping up as volume fills the vault">
        <path
          d="M16 96 L70 96 L70 78 L140 78 L140 56 L220 56 L220 34 L344 34"
          fill="none"
          stroke="#f43f5e"
          strokeWidth="2.2"
        />
        <path
          d="M16 96 L70 96 L70 78 L140 78 L140 56 L220 56 L220 34 L344 34 L344 110 L16 110 Z"
          fill="rgb(244 63 94 / 0.14)"
        />
        <text x="16" y="16" fill="#71717a" fontSize="10">
          P_floor
        </text>
        <text x="16" y="118" fill="#52525b" fontSize="9">
          volume
        </text>
        <text x="250" y="28" fill="#fb7185" fontSize="9">
          never down
        </text>
      </svg>
      <p className="docs-schema-note">
        Vault quote ÷ circulating. Each swap can lift it. Redeem burns tokens and pays quote. Remaining
        holders keep the new floor.
      </p>
    </figure>
  );
}

const HKT_POOL_HOOKS: { id: BrowseHookId; title: string; meta: string }[] = [
  { id: "anti-mev", title: "Anti-MEV", meta: "one swap / block" },
  { id: "anti-snipe", title: "Anti-Snipe", meta: "open window tax" },
  { id: "creator-share-to-hook", title: "Creator → Hook", meta: "60% into the pot" },
  { id: "auto-burn", title: "Auto-Burn", meta: "80% of the pot" },
  { id: "deepen-lps", title: "Deepen LPs", meta: "20% of the pot" },
];

function hookFromId(id: BrowseHookId) {
  const hook = EXPLORE_HOOKS.find((item) => item.id === id);
  if (!hook) throw new Error(`missing hook ${id}`);
  return hook;
}

function HktBurnDiagram() {
  return (
    <figure className="docs-schema">
      <figcaption>$HKT pool: hooks into the token</figcaption>
      <div className="docs-hkt-schema" role="img" aria-label="Hook modules feeding the $HKT token">
        <ul className="docs-hkt-schema-hooks">
          {HKT_POOL_HOOKS.map((item) => {
            const hook = hookFromId(item.id);
            return (
              <li key={item.id} className="docs-hkt-schema-hook">
                <HookLogo hookId={hook.id} theme={hook.theme} />
                <div>
                  <strong className={`orb-hook-title-plain orb-hook-desc-badge--${hook.theme}`}>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="docs-hkt-schema-join" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
          <b />
          <em />
        </div>
        <div className="docs-hkt-schema-token">
          <img src="/brand/hookit-owl-favicon.png" alt="" width={88} height={88} />
        </div>
      </div>
      <p className="docs-schema-note">
        Anti-MEV and Anti-Snipe guard the book. Creator → Hook plus Auto-Burn 80% and Deepen LPs 20%
        spend the pot into this token. Protocol buyback from every other launch burns $HKT too.
      </p>
    </figure>
  );
}

function QuotronsFlywheelDiagram() {
  return (
    <DocsWheel
      caption="Hookit × Quotrons flywheel"
      kicker="Every composite trade"
      center={{ t: "Quotrons", d: "Canonical USDG ↔ wStock hop." }}
      hubLogo="/brand/quotrons-mark.png"
      nodes={[
        { t: "Buy in USDG", d: "Wallet pays USDG. Never holds the wStock." },
        { t: "LP vault 50%", d: "That pool's vault, claimable in USDG." },
        { t: "Deeper books", d: "Fees stay where every wStock launch is priced." },
        { t: "More Hookit volume", d: "Tighter USDG fills. More launches pair here." },
        { t: "Sell to USDG", d: "Token → wStock → USDG in one unlock." },
      ]}
      note="Stronger books make the next USDG fill tighter."
    />
  );
}

function QuotronsFeesDiagram() {
  return (
    <DocsFork
      caption="Where the venue fee goes"
      kicker="Every hop"
      sources={[{ t: "Hook fee", d: "Live take in USDG. 0.30% at writing." }]}
      hub={{ t: "Split 50 / 50", d: "Onchain. No custody. Same fee buy or sell." }}
      outputs={[
        { t: "LP vault", d: "Per-pool. Claimable in USDG." },
        { t: "Terminal pot", d: "Venue-wide. Quiet books ride busy ones." },
        { t: "Epochs → terminals", d: "$250 min, $10,000 cap. Ten hardwired floors." },
      ]}
      note="Quote the fee live. Their own rails can be fee-exempt. A Hookit hop pays."
    />
  );
}

function HktLoopDiagram() {
  return (
    <DocsWheel
      caption="Hold $HKT, get a slice of every launch"
      kicker="Every trade"
      center={{ t: "$HKT", d: "Hold one, get all." }}
      hubLogo="/brand/hookit-owl-favicon.png"
      nodes={[
        { t: "Hold $HKT", d: "Live balance. Pro-rata weight. Not a snapshot." },
        { t: "Any swap", d: "Master or graduated Classic. 1% quote fee." },
        { t: "Buy that ticker", d: "HktHolderDropVault spends quote on the pool." },
        { t: "Epoch push", d: "You receive the other tokens, not more $HKT." },
      ]}
      note="LP and protocol sinks are excluded so they do not eat the drop. More $HKT, larger slice."
    />
  );
}
