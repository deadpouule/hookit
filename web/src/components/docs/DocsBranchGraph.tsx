import type { ReactNode } from "react";

type Box = {
  t: string;
  d: string;
};

function spreadRows(count: number, rows: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.ceil(rows / 2)];
  return Array.from({ length: count }, (_, i) => 1 + Math.round((i * (rows - 1)) / (count - 1)));
}

function slug(text: string) {
  return text.replace(/[^a-z0-9]+/gi, "").slice(0, 24) || "n";
}

/** Bold shaft + head, like a marker stroke pointing at the next segment. */
export function DocsPointArrow({
  down = false,
  label,
}: {
  down?: boolean;
  label?: string;
}) {
  return (
    <span className={down ? "docs-point-arrow is-down" : "docs-point-arrow"} aria-hidden>
      <svg viewBox="0 0 96 36" fill="none">
        <path d="M2 16.5 C 22 15.2, 44 14.6, 62 15.4 L 62 20.6 C 44 21.4, 22 20.8, 2 19.5 Z" fill="currentColor" />
        <path d="M56 5 L94 18 L56 31 L64 18 Z" fill="currentColor" />
      </svg>
      {label ? <em>{label}</em> : null}
    </span>
  );
}

function Card({
  box,
  tone = "node",
  logo,
}: {
  box: Box;
  tone?: "node" | "hub" | "mint" | "logo";
  logo?: string;
}) {
  return (
    <article className={`docs-map-card docs-map-card--${tone}`}>
      {logo ? <img src={logo} alt="" /> : null}
      <strong>{box.t}</strong>
      <span>{box.d}</span>
    </article>
  );
}

function WheelHub({ center, logo }: { center: Box; logo?: string }) {
  return (
    <div className={logo ? "docs-wheel-hub is-logo" : "docs-wheel-hub"}>
      {logo ? <img src={logo} alt="" /> : null}
      <strong>{center.t}</strong>
      <span>{center.d}</span>
    </div>
  );
}

/** Sources feed a hub, hub fans into outputs. One arrow per segment. */
export function DocsFork({
  caption,
  kicker,
  sources = [],
  hub,
  outputs = [],
  note,
  hubNode,
}: {
  caption: string;
  kicker?: string;
  sources?: Box[];
  hub: Box;
  outputs?: Box[];
  note?: string;
  hubNode?: ReactNode;
}) {
  const rows = Math.max(sources.length, outputs.length, 1);
  const srcRows = spreadRows(sources.length, rows);
  const outRows = spreadRows(outputs.length, rows);
  const cols = [
    sources.length > 0 ? "minmax(0, 1.05fr)" : null,
    sources.length > 0 ? "3.4rem" : null,
    "minmax(10.5rem, 0.9fr)",
    outputs.length > 0 ? "3.4rem" : null,
    outputs.length > 0 ? "minmax(0, 1.15fr)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const srcCol = 1;
  const srcArrowCol = sources.length > 0 ? 2 : 0;
  const hubCol = sources.length > 0 ? 3 : 1;
  const outArrowCol = outputs.length > 0 ? hubCol + 1 : 0;
  const outCol = outputs.length > 0 ? hubCol + 2 : 0;

  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      {kicker ? <p className="docs-map-kicker">{kicker}</p> : null}
      <div
        className="docs-fork docs-fork-desk"
        role="img"
        aria-label={caption}
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: `repeat(${rows}, minmax(4.35rem, auto))`,
        }}
      >
        {sources.map((box, i) => (
          <div key={`s-${box.t}`} className="docs-fork-cell" style={{ gridColumn: srcCol, gridRow: srcRows[i] }}>
            <Card box={box} />
          </div>
        ))}
        {sources.map((box, i) => (
          <div
            key={`sa-${box.t}`}
            className="docs-fork-cell docs-fork-cell--arrow"
            style={{ gridColumn: srcArrowCol, gridRow: srcRows[i] }}
          >
            <DocsPointArrow />
          </div>
        ))}
        <div className="docs-fork-cell docs-fork-cell--hub" style={{ gridColumn: hubCol, gridRow: `1 / span ${rows}` }}>
          {hubNode ?? <Card box={hub} tone="hub" />}
        </div>
        {outputs.map((box, i) => (
          <div
            key={`oa-${box.t}`}
            className="docs-fork-cell docs-fork-cell--arrow"
            style={{ gridColumn: outArrowCol, gridRow: outRows[i] }}
          >
            <DocsPointArrow />
          </div>
        ))}
        {outputs.map((box, i) => (
          <div key={`o-${box.t}`} className="docs-fork-cell" style={{ gridColumn: outCol, gridRow: outRows[i] }}>
            <Card box={box} />
          </div>
        ))}
      </div>
      <div className="docs-fork-phone">
        {sources.map((box) => (
          <div key={`ps-${box.t}`} className="docs-wheel-stack-item">
            <Card box={box} />
            <DocsPointArrow down />
          </div>
        ))}
        {hubNode ?? <Card box={hub} tone="hub" />}
        {outputs.map((box) => (
          <div key={`po-${box.t}`} className="docs-wheel-stack-item">
            <DocsPointArrow down />
            <Card box={box} />
          </div>
        ))}
      </div>
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}

function polar(deg: number, r: number, cx: number, cy: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(fromDeg: number, toDeg: number, r: number, cx: number, cy: number) {
  const start = polar(fromDeg, r, cx, cy);
  const end = polar(toDeg, r, cx, cy);
  let delta = toDeg - fromDeg;
  while (delta <= 0) delta += 360;
  const large = delta > 180 ? 1 : 0;
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

/** Amazon-style loop: hub in the middle, nodes on a ring, arrows around the circle. */
export function DocsWheel({
  caption,
  kicker,
  center,
  nodes,
  note,
  hubLogo,
}: {
  caption: string;
  kicker?: string;
  center: Box;
  nodes: Box[];
  note?: string;
  hubLogo?: string;
}) {
  const n = nodes.length;
  const cx = 360;
  const cy = 328;
  const r = 214;
  const step = 360 / n;
  const base = -90;
  const gap = Math.min(32, step * 0.38);
  const markerId = `docs-wheel-${slug(caption + center.t)}`;

  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      {kicker ? <p className="docs-map-kicker">{kicker}</p> : null}
      <div className="docs-wheel" role="img" aria-label={caption}>
        <div className="docs-wheel-ring">
          <svg className="docs-wheel-svg" viewBox="0 0 720 656" aria-hidden>
            <defs>
              <marker
                id={markerId}
                markerWidth="14"
                markerHeight="14"
                refX="12"
                refY="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0 1.2 L13.5 7 L0 12.8 L3.4 7 Z" fill="#f4f4f5" />
              </marker>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="2" />
            {nodes.map((_, i) => {
              const from = base + i * step + gap;
              const to = base + (i + 1) * step - gap;
              return (
                <path
                  key={i}
                  d={arcPath(from, to, r, cx, cy)}
                  fill="none"
                  stroke="#f4f4f5"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </svg>
          <WheelHub center={center} logo={hubLogo} />
          {nodes.map((box, i) => {
            const deg = base + i * step;
            const a = (deg * Math.PI) / 180;
            return (
              <article
                key={box.t}
                className="docs-wheel-node"
                style={{
                  left: `${50 + 38 * Math.cos(a)}%`,
                  top: `${50 + 37 * Math.sin(a)}%`,
                }}
              >
                <strong>{box.t}</strong>
                <span>{box.d}</span>
              </article>
            );
          })}
        </div>
        <div className="docs-wheel-stack">
          <Card box={center} tone={hubLogo ? "logo" : "hub"} logo={hubLogo} />
          {nodes.map((box) => (
            <div key={box.t} className="docs-wheel-stack-item">
              <DocsPointArrow down />
              <Card box={box} />
            </div>
          ))}
          <DocsPointArrow down label="loops" />
        </div>
      </div>
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}

function feeOutTone(title: string): string {
  if (title.includes("$HKT")) return "#22d3ee";
  if (title.toLowerCase().includes("creator")) return "#c084fc";
  if (title.toLowerCase().includes("protocol")) return "#facc15";
  return "#a1a1aa";
}

function feeOutLogo(title: string): string | null {
  if (title.includes("$HKT")) return "/brand/hookit-owl-favicon.png";
  return null;
}

/** Swap into the hook, then one curve per destination. */
export function DocsFeeFlow({
  caption,
  kicker,
  source,
  hub,
  outputs,
  note,
}: {
  caption: string;
  kicker?: string;
  source: Box;
  hub: Box;
  outputs: Box[];
  note?: string;
}) {
  const n = Math.max(outputs.length, 1);
  const row = 86;
  const height = Math.max(340, 28 + n * row);
  const hubY = height / 2;
  const swap = { x: 18, y: hubY - 42, w: 210, h: 84 };
  const hook = { x: 292, y: hubY - 52, w: 228, h: 104 };
  const outX = 620;
  const outW = 252;
  const outH = 72;
  const markerId = `docs-fee-${slug(caption + hub.t)}`;
  const outYs = outputs.map((_, i) => 22 + i * row);

  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      {kicker ? <p className="docs-map-kicker">{kicker}</p> : null}
      <div className="docs-fee-map" role="img" aria-label={caption}>
        <svg viewBox={`0 0 900 ${height}`} className="docs-fee-map-svg">
          <defs>
            <marker
              id={markerId}
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#f4f4f5" />
            </marker>
          </defs>
          <path
            d={`M ${swap.x + swap.w} ${hubY} C ${swap.x + swap.w + 28} ${hubY}, ${hook.x - 28} ${hubY}, ${hook.x} ${hubY}`}
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="2.6"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
          {outputs.map((box, i) => {
            const y = outYs[i] + outH / 2;
            const color = feeOutTone(box.t);
            return (
              <path
                key={box.t}
                d={`M ${hook.x + hook.w} ${hubY} C ${hook.x + hook.w + 44} ${hubY}, ${outX - 40} ${y}, ${outX} ${y}`}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
          <rect x={swap.x} y={swap.y} width={swap.w} height={swap.h} rx="16" fill="#10261c" stroke="rgb(167 243 208 / 0.35)" />
          <text x={swap.x + 18} y={swap.y + 34} fill="#fff" fontSize="15" fontWeight="700">
            {source.t}
          </text>
          <text x={swap.x + 18} y={swap.y + 56} fill="#86efac" fontSize="11">
            {source.d}
          </text>
          <rect x={hook.x} y={hook.y} width={hook.w} height={hook.h} rx="18" fill="#0a0a0a" stroke="rgb(255 255 255 / 0.18)" />
          <image href="/brand/uniswap-mark.png" x={hook.x + 16} y={hook.y + 18} width="28" height="28" />
          <text x={hook.x + 52} y={hook.y + 38} fill="#fff" fontSize="15" fontWeight="700">
            {hub.t}
          </text>
          <text x={hook.x + 16} y={hook.y + 72} fill="#a1a1aa" fontSize="11">
            {hub.d}
          </text>
          {outputs.map((box, i) => {
            const y = outYs[i];
            const logo = feeOutLogo(box.t);
            const color = feeOutTone(box.t);
            return (
              <g key={`box-${box.t}`}>
                <rect
                  x={outX}
                  y={y}
                  width={outW}
                  height={outH}
                  rx="14"
                  fill="#111"
                  stroke={color}
                  strokeOpacity="0.55"
                />
                {logo ? <image href={logo} x={outX + 12} y={y + 18} width="28" height="28" /> : null}
                <text x={outX + (logo ? 48 : 16)} y={y + 28} fill="#fff" fontSize="13" fontWeight="700">
                  {box.t}
                </text>
                <text x={outX + (logo ? 48 : 16)} y={y + 50} fill="#a1a1aa" fontSize="10.5">
                  {box.d}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}

/** Left-to-right sequence. Each step has its own arrow into the next. */
export function DocsPipe({
  caption,
  kicker,
  steps,
  note,
}: {
  caption: string;
  kicker?: string;
  steps: Box[];
  note?: string;
}) {
  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      {kicker ? <p className="docs-map-kicker">{kicker}</p> : null}
      <div className="docs-pipe" role="img" aria-label={caption}>
        {steps.map((box, i) => (
          <div key={box.t} className="docs-pipe-item">
            {i > 0 ? <DocsPointArrow /> : null}
            <Card box={box} tone={i === 0 || i === steps.length - 1 ? "mint" : "node"} />
          </div>
        ))}
      </div>
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}
