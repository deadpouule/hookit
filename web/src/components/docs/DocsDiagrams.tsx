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
            <p>Pool from block 0. Owl totem, modules, locked LP.</p>
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
  const nodes = [
    { x: 180, y: 36, label: "Swap", sub: "quote fee" },
    { x: 300, y: 96, label: "1% base", sub: "always on" },
    { x: 300, y: 196, label: "60 / 10 / 30", sub: "split" },
    { x: 180, y: 256, label: "$HKT drop", sub: "buy token" },
    { x: 60, y: 196, label: "Protocol", sub: "20 / 80" },
    { x: 60, y: 96, label: "Hook pot", sub: "modules" },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Fee flywheel</figcaption>
      <div className="docs-flywheel">
        <svg viewBox="0 0 360 292" role="img" aria-label="Fee flywheel from swap to base split, HKT drop, protocol buyback, and hook modules">
          <circle cx="180" cy="146" r="86" fill="none" stroke="rgb(149 20 209 / 0.35)" strokeWidth="1.5" />
          <circle cx="180" cy="146" r="54" fill="rgb(149 20 209 / 0.1)" stroke="rgb(149 20 209 / 0.45)" strokeWidth="1.2" />
          <text x="180" y="142" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">
            hookit
          </text>
          <text x="180" y="160" textAnchor="middle" fill="#a1a1aa" fontSize="9">
            quote-only
          </text>
          {nodes.map((node, i) => {
            const next = nodes[(i + 1) % nodes.length]!;
            return (
              <line
                key={`e-${node.label}`}
                x1={node.x}
                y1={node.y}
                x2={next.x}
                y2={next.y}
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth="1.2"
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.label}>
              <rect
                x={node.x-46}
                y={node.y-18}
                width="92"
                height="36"
                rx="10"
                fill="#111"
                stroke="rgb(255 255 255 / 0.14)"
              />
              <text x={node.x} y={node.y-2} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                {node.label}
              </text>
              <text x={node.x} y={node.y + 12} textAnchor="middle" fill="#71717a" fontSize="9">
                {node.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="docs-schema-note">
        Every swap feeds the same loop. Hook tax is extra and only funds modules. The 1% base never
        changes its 60 / 10 / 30 split.
      </p>
    </figure>
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
  const steps = [
    { t: "beforeSwap", d: "MEV, caps, 1% + tax" },
    { t: "Take quote", d: "Quote leg only" },
    { t: "Route", d: "60 / 10 / 30 + pot" },
    { t: "afterSwap", d: "Burn + deepen mint" },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Master swap lifecycle</figcaption>
      <ol className="docs-pipe">
        {steps.map((step, i) => (
          <li key={step.t}>
            <div className="docs-pipe-box">
              <strong>{step.t}</strong>
              <p>{step.d}</p>
            </div>
            {i < steps.length-1 ? (
              <span className="docs-pipe-arrow" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="docs-schema-note">
        Fee is never a memecoin tax. Hook pot funds modules. Base 1% is always 60 / 10 / 30.
      </p>
    </figure>
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
      <figcaption>$HKT pool: modules + fee burn</figcaption>
      <div className="docs-hkt-pool">
        <div className="docs-hkt-pool-core">
          <span className="docs-hkt-pool-ticker">$HKT</span>
          <small>Uniswap v4 Master hook</small>
        </div>
        <ul className="docs-hkt-pool-hooks">
          {HKT_POOL_HOOKS.map((item) => {
            const hook = hookFromId(item.id);
            return (
              <li key={item.id} className={`docs-hkt-pool-hook orb-card--${hook.theme}`}>
                <HookLogo hookId={hook.id} theme={hook.theme} />
                <div>
                  <strong className={`orb-hook-title-plain orb-hook-desc-badge--${hook.theme}`}>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <ol className="docs-hkt-pool-flow">
          <li>
            <em>1</em>
            <p>
              <strong>Swap</strong>
              1% quote fee, same 60 / 10 / 30 base as every launch.
            </p>
          </li>
          <li>
            <em>2</em>
            <p>
              <strong>Creator → Hook</strong>
              The 60% creator cut joins hook tax in the pot. Nothing to claim.
            </p>
          </li>
          <li>
            <em>3</em>
            <p>
              <strong>Pot split</strong>
              80% Auto-Burn buys and burns $HKT. 20% Deepen LPs mints into this pool.
            </p>
          </li>
          <li>
            <em>4</em>
            <p>
              <strong>Every other launch</strong>
              80% of the protocol 30% buys $HKT and burns it (HkitBuyback.execute).
            </p>
          </li>
        </ol>
      </div>
      <p className="docs-schema-note">
        Fees taken on the $HKT pool burn $HKT. Protocol buyback from other pools burns $HKT too.
      </p>
    </figure>
  );
}

function HktLoopDiagram() {
  const drops = [
    { t: "$ARB", d: "that pool" },
    { t: "$PEPE", d: "that pool" },
    { t: "$HTEST", d: "that pool" },
    { t: "…", d: "every launch" },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Hold $HKT, get a slice of every launch</figcaption>
      <div className="docs-hkt-thesis">
        <div className="docs-hkt-thesis-col">
          <div className="docs-hkt-thesis-node docs-hkt-thesis-node--you">
            <strong>$HKT</strong>
            <span>your live balance</span>
          </div>
        </div>
        <div className="docs-hkt-thesis-track" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="docs-hkt-thesis-col">
          <div className="docs-hkt-thesis-node">
            <strong>Any hooked swap</strong>
            <span>1% quote fee</span>
          </div>
          <div className="docs-hkt-thesis-node docs-hkt-thesis-node--cut">
            <strong>0.10% of the trade</strong>
            <span>10% of the 1%, mandatory</span>
          </div>
          <div className="docs-hkt-thesis-node">
            <strong>Buy that ticker</strong>
            <span>HktHolderDropVault</span>
          </div>
        </div>
        <div className="docs-hkt-thesis-track" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="docs-hkt-thesis-drops">
          {drops.map((drop) => (
            <div key={drop.t} className="docs-hkt-thesis-chip">
              <strong>{drop.t}</strong>
              <span>{drop.d}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="docs-schema-note">
        You do not receive $HKT from this flow. You receive the other tokens, pro-rata, each epoch.
        More $HKT, larger slice. LP and protocol sinks are excluded.
      </p>
    </figure>
  );
}
