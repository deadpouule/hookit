import { HookLogo } from "@/components/home/market/HookLogo";
import { EXPLORE_HOOKS, type BrowseHookId, type HookTheme } from "@/lib/master-hooks";

function Chip({
  x,
  y,
  src,
  label,
  size = 46,
}: {
  x: number;
  y: number;
  src?: string;
  label?: string;
  size?: number;
}) {
  const pad = size > 36 ? 7 : 4;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size > 36 ? 13 : 8}
        fill="#141414"
        stroke="rgb(255 255 255 / 0.14)"
      />
      {src ? (
        <image href={src} x={x + pad} y={y + pad} width={size-pad*2} height={size-pad*2} />
      ) : null}
      {label ? (
        <text x={x + size / 2} y={y + size + 16} textAnchor="middle" fill="#a1a1aa" fontSize="10">
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Pct({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <g>
      <text x={x} y={y} fill="#f4f4f5" fontSize="22" fontWeight="800">
        {value}
      </text>
      <text x={x + (value.length > 3 ? 58 : 48)} y={y} fill="#d4d4d8" fontSize="13">
        {label}
      </text>
    </g>
  );
}

function LinePct({ x, y, value }: { x: number; y: number; value: string }) {
  const w = value.length > 4 ? 48 : 40;
  return (
    <g>
      <rect x={x-w/2} y={y-11} width={w} height="22" rx="11" fill="#f4f4f5" />
      <text x={x} y={y + 4} textAnchor="middle" fill="#0a0a0a" fontSize="9" fontWeight="800" letterSpacing="0">
        {value}
      </text>
    </g>
  );
}

function Callout({
  x,
  y,
  width,
  height,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
}) {
  const lineH = 14;
  const start = y+(height-(lines.length-1)*lineH)/2+4;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="14"
        fill="#0a0a0a"
        stroke="#f4f4f5"
        strokeOpacity="0.5"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x={x + width / 2}
          y={start + i * lineH}
          textAnchor="middle"
          fill="#f4f4f5"
          fontSize="10"
          fontWeight="800"
          letterSpacing="0"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

const HOOK_SHORT: Record<BrowseHookId, string> = {
  "holder-airdrop": "Airdrop",
  "backed-floor": "Floor",
  "buyback-vesting": "Vest",
  "dynamic-fees": "Dynamic",
  "fixed-fee": "Fixed",
  "deepen-lps": "DeepenLP",
  "auto-burn": "Burn",
  "anti-mev": "MEV",
  "max-tx": "Max Tx",
  "anti-snipe": "Snipe",
  "hook-to-creator": "→ Creator",
  "creator-share-to-hook": "Creator",
};

function HookMark({
  x,
  y,
  hookId,
  theme,
  label,
}: {
  x: number;
  y: number;
  hookId: BrowseHookId;
  theme: HookTheme;
  label: string;
}) {
  const size = 32;
  const pad = 4;
  const inner = size-pad*2;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx="8" fill="#141414" stroke="rgb(255 255 255 / 0.14)" />
      <foreignObject x={x + pad} y={y + pad} width={inner} height={inner}>
        <div className="docs-cycle-hook-fo">
          <HookLogo hookId={hookId} theme={theme} className="docs-cycle-hook-logo" />
        </div>
      </foreignObject>
      <text x={x + size / 2} y={y + size + 16} textAnchor="middle" fill="#a1a1aa" fontSize="10" letterSpacing="0">
        {label}
      </text>
    </g>
  );
}

const PILE_STOCKS: { src: string; x: number; y: number; size: number }[] = [
  { src: "/pairing/wnvdax.svg", x: 534, y: 228, size: 28 },
  { src: "/pairing/waaplx.svg", x: 578, y: 214, size: 26 },
  { src: "/pairing/wtslax.png", x: 620, y: 226, size: 28 },
  { src: "/pairing/wgooglx.svg", x: 660, y: 258, size: 26 },
  { src: "/pairing/wamznx.svg", x: 672, y: 300, size: 26 },
  { src: "/pairing/wmcdx.svg", x: 656, y: 336, size: 24 },
  { src: "/pairing/wnflxx.svg", x: 628, y: 350, size: 24 },
  { src: "/pairing/wspyx.svg", x: 530, y: 348, size: 24 },
  { src: "/pairing/wmstrx.svg", x: 512, y: 322, size: 26 },
  { src: "/pairing/usdg.png", x: 522, y: 272, size: 26 },
];

const PILE_MEMES: { src: string; x: number; y: number; size: number }[] = [
  { src: "/memes/pepe.png", x: 548, y: 246, size: 32 },
  { src: "/memes/doge.png", x: 598, y: 236, size: 32 },
  { src: "/memes/wif.png", x: 636, y: 278, size: 32 },
  { src: "/memes/shib.png", x: 566, y: 316, size: 32 },
];

const HOOK_STRIDE = 38;
const HOOK_X0 = 193;
const HOOK_Y0 = 668;

export function DocsCycleArt() {
  return (
    <figure className="docs-schema docs-schema--wide">
      <figcaption>Every swap feeds $HKT</figcaption>
      <p className="docs-map-kicker">Token buybacks. Holder drops. A connected fee cycle.</p>
      <div className="docs-cycle" role="img" aria-label="Every launch and every swap on hookit feeds $HKT">
        <svg viewBox="0 0 1240 880" className="docs-cycle-svg" style={{ letterSpacing: 0 }}>
          <defs>
            <marker id="docs-cycle-w" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#f4f4f5" />
            </marker>
          </defs>

          <text x="36" y="36" fill="#71717a" fontSize="11" letterSpacing="2.2">
            LAUNCHED ON HOOKIT
          </text>
          <text x="250" y="36" fill="#71717a" fontSize="11" letterSpacing="2.2">
            SHARE OF THE 1%
          </text>
          <Pct x={250} y={66} value="60%" label="Creator" />
          <text x="400" y="66" fill="#f4f4f5" fontSize="22" fontWeight="800">
            10%
          </text>
          <text x="458" y="66" fill="#d4d4d8" fontSize="12">
            AIRDROP TO $HKT holders
          </text>
          <text x="720" y="66" fill="#f4f4f5" fontSize="22" fontWeight="800">
            30%
          </text>
          <text x="778" y="66" fill="#d4d4d8" fontSize="13">
            Protocol
          </text>
          <text x="720" y="84" fill="#a1a1aa" fontSize="11">
            (80% buyback burn 20% fund ops)
          </text>

          <Chip x={40} y={88} src="/memes/pepe.png" />
          <Chip x={16} y={168} src="/memes/doge.png" />
          <Chip x={68} y={168} src="/memes/wif.png" />
          <Chip x={40} y={248} src="/memes/shib.png" />

          <path d="M 86 111 C 150 140, 190 230, 200 272" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 62 191 C 140 220, 180 255, 200 280" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 114 191 C 160 230, 185 265, 200 284" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 86 271 C 150 290, 185 295, 200 296" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

          <rect x="200" y="236" width="214" height="102" rx="28" fill="#0a0a0a" stroke="#f4f4f5" strokeWidth="2" />
          <text x="307" y="260" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            Swap
          </text>
          <text x="307" y="282" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">
            1% + (0-9% hook taxes)
          </text>
          <text x="307" y="302" textAnchor="middle" fill="#a1a1aa" fontSize="11">
            quote fee
          </text>

          <Chip x={40} y={348} src="/brand/quotrons-mark.png" label="wStock" />
          <path d="M 86 371 C 150 360, 180 330, 200 314" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <Chip x={40} y={414} src="/pairing/usdg.png" label="USDG" size={32} />
          <Chip x={78} y={414} src="/pairing/wnvdax.svg" label="NVDA" size={32} />
          <Chip x={116} y={414} src="/pairing/waaplx.svg" label="AAPL" size={32} />
          <Chip x={154} y={414} src="/pairing/wtslax.png" label="TSLA" size={32} />
          <Chip x={40} y={470} src="/pairing/wspyx.svg" label="SPY" size={32} />
          <Chip x={78} y={470} src="/pairing/wgooglx.svg" label="GOOG" size={32} />
          <Chip x={116} y={470} src="/pairing/wamznx.svg" label="AMZN" size={32} />
          <Chip x={154} y={470} src="/pairing/wnflxx.svg" label="NFLX" size={32} />

          <path d="M 414 268 C 430 190, 400 160, 448 147" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <path d="M 414 292 C 460 292, 500 292, 514 292" fill="none" stroke="#f4f4f5" strokeWidth="2.6" markerEnd="url(#docs-cycle-w)" />
          <Callout x={416} y={268} width={96} height={36} lines={["10% buys", "the ticker"]} />
          <path d="M 360 338 C 380 430, 400 500, 448 522" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />

          <rect x="448" y="125" width="190" height="44" rx="14" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="464" y="153" fill="#f4f4f5" fontSize="14" fontWeight="800">
            60% Creator (choice)
          </text>

          <path d="M 638 137 C 670 108, 690 108, 698 112" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 638 147 C 670 168, 690 178, 698 182" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 638 157 C 670 234, 690 248, 698 252" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

          <rect x="702" y="100" width="210" height="44" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <text x="718" y="128" fill="#fff" fontSize="12" fontWeight="700">
            Escrow
          </text>
          <rect x="702" y="158" width="210" height="56" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <foreignObject x="714" y="174" width="24" height="24">
            <div className="docs-cycle-hook-fo">
              <HookLogo hookId="buyback-vesting" theme="void" className="docs-cycle-hook-logo" />
            </div>
          </foreignObject>
          <text x="744" y="184" fill="#fff" fontSize="12" fontWeight="700">
            Buyback Vesting
          </text>
          <text x="744" y="200" fill="#a1a1aa" fontSize="10">
            time or FDV target
          </text>
          <rect x="702" y="228" width="210" height="44" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <foreignObject x="714" y="238" width="24" height="24">
            <div className="docs-cycle-hook-fo">
              <HookLogo hookId="creator-share-to-hook" theme="yellow" className="docs-cycle-hook-logo" />
            </div>
          </foreignObject>
          <text x="744" y="256" fill="#fff" fontSize="12" fontWeight="700">
            Creator → Hook
          </text>

          <circle cx="590" cy="292" r="74" fill="#0a0a0a" stroke="#f4f4f5" strokeWidth="2.4" />
          {PILE_STOCKS.map((item) => (
            <Chip key={`${item.src}-${item.x}`} x={item.x} y={item.y} src={item.src} size={item.size} />
          ))}
          {PILE_MEMES.map((item) => (
            <Chip key={item.src} x={item.x} y={item.y} src={item.src} size={item.size} />
          ))}

          <rect x="448" y="516" width="210" height="44" rx="14" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="464" y="544" fill="#f4f4f5" fontSize="14" fontWeight="800">
            30% Protocol
          </text>

          <path d="M 664 300 C 800 328, 870 310, 922 300" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <Callout x={760} y={314} width={188} height={28} lines={["Sent to $HKT Holders."]} />
          <rect x="922" y="250" width="280" height="100" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <image href="/brand/hookit-owl-favicon.png" x="938" y="272" width="44" height="44" />
          <text x="992" y="288" fill="#fff" fontSize="14" fontWeight="700">
            Holders $HKT
          </text>
          <text x="992" y="308" fill="#a1a1aa" fontSize="11">
            Hold one, get all
          </text>
          <text x="992" y="326" fill="#a1a1aa" fontSize="11">
            Airdropped to all $HKT holders
          </text>

          <path d="M 658 536 C 800 536, 900 500, 918 448" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <LinePct x={800} y={528} value="80%" />
          <rect x="922" y="380" width="280" height="52" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <image href="/brand/hookit-owl-favicon.png" x="938" y="388" width="36" height="36" />
          <text x="984" y="412" fill="#fff" fontSize="13" fontWeight="700">
            Buy $HKT and burn
          </text>

          <path d="M 658 548 C 780 580, 860 590, 918 592" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <LinePct x={800} y={582} value="20%" />
          <rect x="922" y="568" width="280" height="52" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="940" y="600" fill="#fff" fontSize="13" fontWeight="700">
            Funds ops protocole
          </text>

          <path d="M 307 338 C 307 420, 307 620, 307 668" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <text x="322" y="630" fill="#f4f4f5" fontSize="11" fontWeight="700">
            (0-9% optional)
          </text>
          {EXPLORE_HOOKS.map((hook, i) => (
            <HookMark
              key={hook.id}
              x={HOOK_X0 + (i % 6) * HOOK_STRIDE + (i < 6 ? 0 : 19)}
              y={i < 6 ? HOOK_Y0 : HOOK_Y0 + 56}
              hookId={hook.id}
              theme={hook.theme}
              label={HOOK_SHORT[hook.id]}
            />
          ))}
          <path
            d="M 186 705 C 60 700, 12 620, 10 500 C 8 400, 8 330, 12 300 C 18 278, 28 272, 40 271"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="2"
            markerEnd="url(#docs-cycle-w)"
          />
          <Callout
            x={32}
            y={548}
            width={210}
            height={48}
            lines={["v4 hooks who benefit", "for tokens launched on hookit"]}
          />
          <path
            d="M 418 760 C 700 760, 1000 760, 1210 760 C 1234 760, 1234 400, 1202 300"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="2"
            markerEnd="url(#docs-cycle-w)"
          />
          <Callout
            x={720}
            y={766}
            width={250}
            height={96}
            lines={[
              "$HKT holders receive hooked tokens",
              "and the perks of tokens launched",
              "(airdrop, vesting, stocks",
              "or token airdrops)",
            ]}
          />
        </svg>
      </div>
      <p className="docs-schema-note">
        Every Master and graduated Classic swap pays the 1% in quote. The 10% $HKT slice cannot be
        removed. More volume, more dollars for $HKT holders.
      </p>
    </figure>
  );
}
