import { HookLogo } from "@/components/home/market/HookLogo";
import type { DocsDiagramId } from "@/lib/docs-content";
import {
  EXPLORE_HOOKS,
  MASTER_HOOK_FILTERS,
  type MasterHookCategory,
} from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

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
                    <h4>{hook.title}</h4>
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
      <div className="docs-rails">
        <div className="docs-rail docs-rail--master">
          <p className="docs-rail-kicker">Master</p>
          <h4>Pool from block 0</h4>
          <ol>
            <li>LaunchFactory</li>
            <li>LaunchToken + v4 pool</li>
            <li>Locked in-range LP</li>
            <li>MasterLaunchHook modules</li>
          </ol>
        </div>
        <div className="docs-rail-vs" aria-hidden>
          or
        </div>
        <div className="docs-rail docs-rail--classic">
          <p className="docs-rail-kicker">Classic</p>
          <h4>Bond, then graduate</h4>
          <ol>
            <li>BondingLaunchFactory</li>
            <li>80% sold on CPMM curve</li>
            <li>4.2 ETH-eq threshold</li>
            <li>GraduatedFeeHook pool</li>
          </ol>
        </div>
      </div>
    </figure>
  );
}

function StackDiagram() {
  const layers = [
    { k: "App", v: "hookit.fun — marketplace, launch wizard, token desk" },
    { k: "Router", v: "HookitSwapRouter — hooked swaps, composite quote legs" },
    { k: "Hook", v: "MasterLaunchHook / GraduatedFeeHook — quote-only fees + modules" },
    { k: "Pool", v: "Uniswap v4 PoolManager — fee tier 0, locked liquidity" },
    { k: "Ink", v: "Chain 57073 — ETH gas, USDG + Quotrons wStocks as quotes" },
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
                x={node.x - 46}
                y={node.y - 18}
                width="92"
                height="36"
                rx="10"
                fill="#111"
                stroke="rgb(255 255 255 / 0.14)"
              />
              <text x={node.x} y={node.y - 2} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
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
      <figcaption>1% base fee — 60 / 10 / 30</figcaption>
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
    { n: "01", t: "beforeSwap", d: "Anti-MEV, max-tx, max-wallet. Compute 1% + hook tax + snipe." },
    { n: "02", t: "Take quote", d: "Fee is pulled from the quote leg only. Never a memecoin tax." },
    { n: "03", t: "Route", d: "Hook pot → modules. Base 1% → 60 / 10 / 30." },
    { n: "04", t: "afterSwap", d: "Pending auto-burn buy+burn and Deepen LPs mint." },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Master swap lifecycle</figcaption>
      <ol className="docs-lifecycle">
        {steps.map((step) => (
          <li key={step.n}>
            <span>{step.n}</span>
            <h4>{step.t}</h4>
            <p>{step.d}</p>
          </li>
        ))}
      </ol>
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
  const nodes = [
    { t: "Hook tax", d: "Share of the hook pot" },
    { t: "FloorVault", d: "Quote collateral only" },
    { t: "P_floor", d: "V / S, ratchet up" },
    { t: "Redeem", d: "Burn token, take quote" },
  ];
  return (
    <figure className="docs-schema">
      <figcaption>Backed floor loop</figcaption>
      <ol className="docs-lifecycle">
        {nodes.map((node, i) => (
          <li key={node.t}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <h4>{node.t}</h4>
            <p>{node.d}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
