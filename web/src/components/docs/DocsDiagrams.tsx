import { DocsBranchGraph } from "@/components/docs/DocsBranchGraph";
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
    <DocsBranchGraph
      caption="Where every swap goes"
      kicker="Every trade"
      sources={[
        { t: "1% base", d: "Mandatory. Quote only." },
        { t: "Hook tax", d: "Optional Master extra, 0 to 9%." },
      ]}
      hub={{ t: "MasterLaunchHook", d: "One take. Shares set at launch." }}
      outputs={[
        { t: "Creator 60%", d: "FeeEscrow, Buyback Vesting, or Creator → Hook." },
        { t: "$HKT drop 10%", d: "Buys that pool's ticker for live $HKT holders." },
        { t: "Protocol 30%", d: "20% ops. 80% buys $HKT and burns it." },
        { t: "Hook pot", d: "Tax (plus creator 60% if routed). Burn, floor, deepen, airdrop." },
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
    <DocsBranchGraph
      caption="Master swap lifecycle"
      kicker="One unlock"
      sources={[
        { t: "beforeSwap", d: "Anti-MEV, Anti-Snipe, Max Tx." },
        { t: "Take quote", d: "1% base plus hook tax. Quote leg only." },
      ]}
      hub={{ t: "Route", d: "60 / 10 / 30 on the 1%. Tax into the pot." }}
      outputs={[
        { t: "Creator 60%", d: "Escrow, vest, or hook pot." },
        { t: "$HKT drop 10%", d: "Buy this ticker. Push next epoch." },
        { t: "Protocol 30%", d: "Ops 20%. Native buyback and burn 80%." },
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
  const steps = [
    {
      n: "01",
      t: "Hookit trade",
      d: "Buy in USDG or sell back to USDG. Wallet never holds the wStock.",
    },
    {
      n: "02",
      t: "Quotrons LP hop",
      d: "Canonical USDG ↔ wStock book. One unlock with the hooked launch pool.",
    },
    {
      n: "03",
      t: "Venue fee",
      d: "Live hook fee in USDG. 50% LP vault. 50% hardwired terminals.",
    },
    {
      n: "04",
      t: "Holders and books",
      d: "More fees to Quotrons holders. Deeper books. More Hookit launches.",
    },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Hookit × Quotrons flywheel</figcaption>
      <div className="docs-qfly" role="img" aria-label="Every Hookit composite trade pays Quotrons LPs and holders, then deeper books pull more launches">
        <div className="docs-qfly-loop">
          {steps.map((step) => (
            <article key={step.n} className="docs-qfly-step">
              <span>{step.n}</span>
              <strong>{step.t}</strong>
              <p>{step.d}</p>
            </article>
          ))}
          <div className="docs-qfly-hub">
            <div className="docs-qfly-marks">
              <img src="/brand/hookit-owl-favicon.png" alt="" width={36} height={36} />
              <img src="/brand/quotrons-mark.png" alt="" width={36} height={36} />
            </div>
            <b>Win-win</b>
          </div>
        </div>
        <div className="docs-split-bar" role="img" aria-label="Quotrons hop fee, half LP vault, half holders">
          <div className="docs-split-seg docs-split-seg--q-lp" style={{ flex: 50 }}>
            <span>50%</span>
            <small>LP vault</small>
          </div>
          <div className="docs-split-seg docs-split-seg--q-hold" style={{ flex: 50 }}>
            <span>50%</span>
            <small>Holders</small>
          </div>
        </div>
      </div>
      <p className="docs-schema-note">
        Each composite swap hits a Quotrons LP. Their hook takes USDG, splits it, and pays the venue.
        More Hookit volume raises that stream. Stronger books make the next USDG fill tighter.
      </p>
    </figure>
  );
}

function HktLoopDiagram() {
  return (
    <DocsBranchGraph
      caption="Hold $HKT, get a slice of every launch"
      kicker="Every trade"
      sources={[
        { t: "$HKT bag", d: "Your live balance. Pro-rata weight." },
        { t: "Any hooked swap", d: "1% quote fee. Master or graduated Classic." },
      ]}
      hub={{ t: "0.10% of the trade", d: "10% of the 1%. Mandatory." }}
      outputs={[
        { t: "Buy that ticker", d: "HktHolderDropVault spends quote on the pool." },
        { t: "Epoch push", d: "Live $HKT holders. Not a snapshot." },
        { t: "Every launch", d: "$ARB, $PEPE, the next ticker. Same weight." },
        { t: "Not more $HKT", d: "You receive the other tokens." },
      ]}
      note="LP and protocol sinks are excluded so they do not eat the drop. More $HKT, larger slice."
    />
  );
}
