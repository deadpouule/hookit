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

function TokenChip({ x, y, size = 46 }: { x: number; y: number; size?: number }) {
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
      <text
        x={x + size / 2}
        y={y + size / 2 + (size > 36 ? 4 : 3)}
        textAnchor="middle"
        fill="#d4d4d8"
        fontSize={size > 36 ? 9 : size > 26 ? 8 : 7}
        fontWeight="700"
        letterSpacing="0"
      >
        token
      </text>
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

const HOOK_SHORT: Record<BrowseHookId, string> = {
  "holder-airdrop": "Airdrop",
  "backed-floor": "Floor",
  "buyback-vesting": "Vest",
  "dynamic-fees": "Dynamic",
  "fixed-fee": "Fixed",
  "deepen-lps": "Deepen",
  "auto-burn": "Burn",
  "anti-mev": "MEV",
  "max-tx": "Max Tx",
  "anti-snipe": "Snipe",
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
  return (
    <g>
      <rect x={x} y={y} width="36" height="36" rx="10" fill="#141414" stroke="rgb(255 255 255 / 0.14)" />
      <foreignObject x={x + 6} y={y + 6} width="24" height="24">
        <div className="docs-cycle-hook-fo">
          <HookLogo hookId={hookId} theme={theme} className="docs-cycle-hook-logo" />
        </div>
      </foreignObject>
      <text x={x + 18} y={y + 50} textAnchor="middle" fill="#d4d4d8" fontSize="8" fontWeight="700" letterSpacing="0">
        {label}
      </text>
    </g>
  );
}

const PILE_STOCKS: { src: string; x: number; y: number; size: number }[] = [
  { src: "/pairing/wnvdax.svg", x: 504, y: 228, size: 28 },
  { src: "/pairing/waaplx.svg", x: 548, y: 214, size: 26 },
  { src: "/pairing/wtslax.png", x: 590, y: 226, size: 28 },
  { src: "/pairing/wgooglx.svg", x: 630, y: 258, size: 26 },
  { src: "/pairing/wamznx.svg", x: 642, y: 300, size: 26 },
  { src: "/pairing/wmcdx.svg", x: 626, y: 336, size: 24 },
  { src: "/pairing/wnflxx.svg", x: 598, y: 350, size: 24 },
  { src: "/pairing/wspyx.svg", x: 500, y: 348, size: 24 },
  { src: "/pairing/wmstrx.svg", x: 482, y: 322, size: 26 },
  { src: "/pairing/usdg.png", x: 476, y: 272, size: 26 },
];

const PILE_TOKENS: { key: string; x: number; y: number }[] = [
  { key: "p-token-a", x: 500, y: 248 },
  { key: "p-token-b", x: 568, y: 240 },
  { key: "p-token-c", x: 612, y: 286 },
  { key: "p-token-d", x: 568, y: 328 },
  { key: "p-token-e", x: 508, y: 322 },
  { key: "p-token-f", x: 492, y: 286 },
];

export function DocsCycleArt() {
  return (
    <figure className="docs-schema docs-schema--wide">
      <figcaption>Every swap feeds $HKT</figcaption>
      <p className="docs-map-kicker">Token buybacks. Holder drops. A connected fee cycle.</p>
      <div className="docs-cycle" role="img" aria-label="Every launch and every swap on hookit feeds $HKT">
        <svg viewBox="0 0 1240 840" className="docs-cycle-svg" style={{ letterSpacing: 0 }}>
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
          <Pct x={400} y={66} value="10%" label="$HKT" />
          <Pct x={530} y={66} value="30%" label="Protocol" />

          <TokenChip x={40} y={88} />
          <TokenChip x={16} y={168} />
          <TokenChip x={68} y={168} />
          <TokenChip x={40} y={248} />

          <path d="M 86 111 C 150 140, 190 230, 200 272" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 62 191 C 140 220, 180 255, 200 280" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 114 191 C 160 230, 185 265, 200 284" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 86 271 C 150 290, 185 295, 200 296" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

          <rect x="200" y="246" width="214" height="92" rx="28" fill="#0a0a0a" stroke="#f4f4f5" strokeWidth="2" />
          <text x="307" y="284" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">
            1% + (0-9% hook taxes)
          </text>
          <text x="307" y="304" textAnchor="middle" fill="#a1a1aa" fontSize="11">
            quote fee
          </text>
          <text x="414" y="358" textAnchor="end" fill="#71717a" fontSize="11">
            MasterLaunchHook
          </text>

          <Chip x={40} y={348} src="/brand/quotrons-mark.png" label="wStock" />
          <path d="M 86 371 C 150 360, 180 330, 200 314" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <Chip x={16} y={448} src="/pairing/usdg.png" label="USDG" size={32} />
          <Chip x={54} y={448} src="/pairing/wnvdax.svg" label="NVDA" size={32} />
          <Chip x={92} y={448} src="/pairing/waaplx.svg" label="AAPL" size={32} />
          <Chip x={130} y={448} src="/pairing/wtslax.png" label="TSLA" size={32} />
          <Chip x={16} y={512} src="/pairing/wspyx.svg" label="SPY" size={32} />
          <Chip x={54} y={512} src="/pairing/wgooglx.svg" label="GOOG" size={32} />
          <Chip x={92} y={512} src="/pairing/wamznx.svg" label="AMZN" size={32} />
          <Chip x={130} y={512} src="/pairing/wnflxx.svg" label="NFLX" size={32} />

          <path d="M 414 268 C 430 170, 400 130, 448 118" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <path d="M 414 292 C 450 292, 490 292, 486 292" fill="none" stroke="#f4f4f5" strokeWidth="2.6" markerEnd="url(#docs-cycle-w)" />
          <LinePct x={432} y={292} value="10%" />
          <path d="M 360 338 C 380 430, 400 500, 448 522" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />

          <rect x="448" y="96" width="150" height="44" rx="14" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="464" y="124" fill="#f4f4f5" fontSize="14" fontWeight="800">
            60% Creator
          </text>

          <path d="M 598 108 C 640 70, 670 70, 698 78" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 598 118 C 640 130, 670 140, 698 148" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 598 128 C 640 190, 670 210, 698 218" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

          <rect x="702" y="56" width="210" height="44" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <text x="718" y="84" fill="#fff" fontSize="12" fontWeight="700">
            Escrow
          </text>
          <rect x="702" y="116" width="210" height="56" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <foreignObject x="714" y="132" width="24" height="24">
            <div className="docs-cycle-hook-fo">
              <HookLogo hookId="buyback-vesting" theme="void" className="docs-cycle-hook-logo" />
            </div>
          </foreignObject>
          <text x="744" y="142" fill="#fff" fontSize="12" fontWeight="700">
            Buyback Vesting
          </text>
          <text x="744" y="158" fill="#a1a1aa" fontSize="10">
            time or FDV target
          </text>
          <rect x="702" y="188" width="210" height="44" rx="12" fill="#111" stroke="rgb(255 255 255 / 0.16)" />
          <foreignObject x="714" y="198" width="24" height="24">
            <div className="docs-cycle-hook-fo">
              <HookLogo hookId="creator-share-to-hook" theme="lime" className="docs-cycle-hook-logo" />
            </div>
          </foreignObject>
          <text x="744" y="216" fill="#fff" fontSize="12" fontWeight="700">
            Creator → Hook
          </text>
          <text x="702" y="252" fill="#a1a1aa" fontSize="11">
            A choice. Pick one.
          </text>

          <circle cx="560" cy="292" r="74" fill="#0a0a0a" stroke="#f4f4f5" strokeWidth="2.4" />
          {PILE_STOCKS.map((item) => (
            <Chip key={`${item.src}-${item.x}`} x={item.x} y={item.y} src={item.src} size={item.size} />
          ))}
          {PILE_TOKENS.map((item) => (
            <TokenChip key={item.key} x={item.x} y={item.y} size={32} />
          ))}

          <rect x="448" y="516" width="210" height="44" rx="14" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="464" y="544" fill="#f4f4f5" fontSize="14" fontWeight="800">
            30% Protocol
          </text>

          <path d="M 634 300 C 780 320, 880 280, 922 228" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <rect x="922" y="155" width="280" height="100" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <image href="/brand/hookit-owl-favicon.png" x="938" y="177" width="44" height="44" />
          <text x="992" y="193" fill="#fff" fontSize="14" fontWeight="700">
            Holders $HKT
          </text>
          <text x="992" y="213" fill="#a1a1aa" fontSize="11">
            Hold one, get all
          </text>
          <text x="992" y="231" fill="#a1a1aa" fontSize="11">
            10% buys that ticker. Epoch push.
          </text>

          <path d="M 658 536 C 800 536, 900 500, 918 456" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <LinePct x={800} y={528} value="80%" />
          <rect x="922" y="380" width="280" height="78" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <image href="/brand/hookit-owl-favicon.png" x="938" y="398" width="36" height="36" />
          <text x="984" y="412" fill="#fff" fontSize="13" fontWeight="700">
            Buy $HKT and burn
          </text>
          <text x="984" y="432" fill="#f4f4f5" fontSize="11" fontWeight="700">
            80% of protocol cut
          </text>
          <text x="984" y="448" fill="#a1a1aa" fontSize="11">
            Supply goes down
          </text>
          <LinePct x={1062} y={474} value="20%" />

          <path d="M 658 548 C 780 580, 860 590, 918 592" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <rect x="922" y="568" width="280" height="52" rx="16" fill="#111" stroke="#f4f4f5" strokeOpacity="0.35" />
          <text x="940" y="600" fill="#fff" fontSize="13" fontWeight="700">
            Funds ops protocole
          </text>

          <path
            d="M 1060 458 C 1140 490, 1180 340, 634 330"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="2.2"
            strokeDasharray="6 6"
            markerEnd="url(#docs-cycle-w)"
          />
          <text x="1224" y="328" textAnchor="end" fill="#f4f4f5" fontSize="11" fontWeight="700">
            Buy $HKT again
          </text>

          <path d="M 307 338 C 307 420, 307 620, 307 678" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <text x="322" y="630" fill="#f4f4f5" fontSize="11" fontWeight="700">
            (0-9% optional)
          </text>
          <rect x="214" y="682" width="170" height="58" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          <text x="230" y="706" fill="#fff" fontSize="12" fontWeight="700">
            Hook tax
          </text>
          <text x="230" y="724" fill="#a1a1aa" fontSize="11">
            Optional. Fills the pot.
          </text>
          <path d="M 384 711 C 410 711, 430 711, 452 711" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <rect x="456" y="668" width="700" height="148" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          {EXPLORE_HOOKS.map((hook, i) => (
            <HookMark
              key={hook.id}
              x={476 + (i % 6) * 110}
              y={i < 6 ? 684 : 748}
              hookId={hook.id}
              theme={hook.theme}
              label={HOOK_SHORT[hook.id]}
            />
          ))}
        </svg>
      </div>
      <p className="docs-schema-note">
        Every Master and graduated Classic swap pays the 1% in quote. The 10% $HKT slice cannot be
        removed. More volume, more dollars for $HKT holders.
      </p>
    </figure>
  );
}
