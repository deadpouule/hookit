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

function EthChip({ x, y, size = 46 }: { x: number; y: number; size?: number }) {
  const s = size / 46;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={13 * s} fill="#627eea" stroke="rgb(255 255 255 / 0.14)" />
      <path
        transform={`translate(${x + 11 * s} ${y + 8 * s}) scale(${1.05 * s})`}
        fill="#fff"
        d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
      />
      {size >= 40 ? (
        <text x={x + size / 2} y={y + size + 16} textAnchor="middle" fill="#a1a1aa" fontSize="10">
          ETH
        </text>
      ) : null}
    </g>
  );
}

function MemeChip({
  x,
  y,
  label,
  fill,
  size = 46,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
  size?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size > 36 ? 13 : 8} fill={fill} />
      <text
        x={x + size / 2}
        y={y + size / 2 + (size > 36 ? 4 : 3)}
        textAnchor="middle"
        fill="#0a0a0a"
        fontSize={size > 36 ? 10 : 7}
        fontWeight="800"
      >
        {label}
      </text>
    </g>
  );
}

function Pct({
  x,
  y,
  value,
  label,
  color,
}: {
  x: number;
  y: number;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <g>
      <text x={x} y={y} fill={color} fontSize="22" fontWeight="800">
        {value}
      </text>
      <text x={x + (value.length > 3 ? 58 : 48)} y={y} fill="#d4d4d8" fontSize="13">
        {label}
      </text>
    </g>
  );
}

function HookGlyph({
  id,
  color,
}: {
  id: "auto-burn" | "backed-floor" | "deepen-lps" | "holder-airdrop";
  color: string;
}) {
  if (id === "auto-burn") {
    return (
      <g fill="none">
        <path
          d="M12 2.8c1.7 2.6 5.2 5.1 5.2 9.1A5.2 5.2 0 0 1 7 11.9C7 8.4 10.2 5.6 12 2.8Z"
          fill={color}
          fillOpacity="0.22"
          stroke={color}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M12 8.2c1 1.6 2.6 2.8 2.6 4.7A2.6 2.6 0 0 1 9.4 13c0-1.7 1.5-3 2.6-4.8Z" fill={color} />
      </g>
    );
  }
  if (id === "backed-floor") {
    return <path d="M14 8h7v3H14zM9 12h12v3H9zM3 16h18v5H3z" fill={color} />;
  }
  if (id === "deepen-lps") {
    return (
      <g>
        <path d="M2.2 5.1h4v2.15H2.2zM2.2 7.25h6.2v2.15H2.2zM2.2 9.4h8.2v2.15H2.2zM2.2 11.55h9.5v2.25H2.2zM2.2 13.8h10.3v5.1H2.2z" fill={color} />
        <path
          d="M17.8 5.1h4v2.15h-4zM15.6 7.25h6.2v2.15h-6.2zM13.6 9.4h8.2v2.15h-8.2zM12.3 11.55h9.5v2.25h-9.5zM11.5 13.8h10.3v5.1H11.5z"
          fill={color}
          fillOpacity="0.42"
        />
      </g>
    );
  }
  return (
    <g fill="none">
      <path d="M3.8 10.2C3.8 5.4 7.4 2.2 12 2.2s8.2 3.2 8.2 8Z" fill={color} />
      <path
        d="M5.6 10.2 9.1 16.6M9.4 10.2 10.5 16.6M14.6 10.2 13.5 16.6M18.4 10.2 14.9 16.6"
        stroke={color}
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <rect x="8.2" y="16.4" width="7.6" height="5.2" rx="0.45" fill={color} />
      <rect x="7.6" y="16.15" width="8.8" height="1.45" rx="0.3" fill={color} />
    </g>
  );
}

function HookTaxMark({
  x,
  y,
  id,
  color,
  label,
}: {
  x: number;
  y: number;
  id: "auto-burn" | "backed-floor" | "deepen-lps" | "holder-airdrop";
  color: string;
  label: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="36" height="36" rx="10" fill="#141414" stroke="rgb(255 255 255 / 0.14)" />
      <g transform={`translate(${x + 6} ${y + 6})`}>
        <HookGlyph id={id} color={color} />
      </g>
      <text x={x + 18} y={y + 50} textAnchor="middle" fill="#d4d4d8" fontSize="9" fontWeight="700">
        {label}
      </text>
    </g>
  );
}

const MEME_COLORS = ["#ff6b9d", "#c8ff3d", "#ff8a3d", "#7c5cff", "#3dffd0", "#ffd23d"] as const;

const PILE_STOCKS: { src: string; x: number; y: number; size: number }[] = [
  { src: "/pairing/wnvdax.svg", x: 498, y: 232, size: 28 },
  { src: "/pairing/waaplx.svg", x: 546, y: 218, size: 26 },
  { src: "/pairing/wtslax.png", x: 592, y: 232, size: 28 },
  { src: "/pairing/wgooglx.svg", x: 628, y: 268, size: 26 },
  { src: "/pairing/wamznx.svg", x: 636, y: 310, size: 26 },
  { src: "/pairing/wmcdx.svg", x: 612, y: 350, size: 24 },
  { src: "/pairing/wnflxx.svg", x: 568, y: 366, size: 26 },
  { src: "/pairing/wspyx.svg", x: 520, y: 360, size: 24 },
  { src: "/pairing/wmstrx.svg", x: 484, y: 328, size: 26 },
  { src: "/pairing/usdg.png", x: 478, y: 278, size: 26 },
];

const PILE_MEMES: { label: string; fill: string; x: number; y: number }[] = [
  { label: "meme1", fill: MEME_COLORS[0], x: 518, y: 250 },
  { label: "meme2", fill: MEME_COLORS[1], x: 574, y: 248 },
  { label: "meme3", fill: MEME_COLORS[2], x: 608, y: 292 },
  { label: "meme4", fill: MEME_COLORS[3], x: 572, y: 336 },
  { label: "meme5", fill: MEME_COLORS[4], x: 516, y: 332 },
  { label: "meme6", fill: MEME_COLORS[5], x: 500, y: 292 },
];

export function DocsCycleArt() {
  return (
    <figure className="docs-schema docs-schema--wide">
      <figcaption>Every swap feeds $HKT</figcaption>
      <p className="docs-map-kicker">Token buybacks. Holder drops. A connected fee cycle.</p>
      <div className="docs-cycle" role="img" aria-label="Every launch and every swap on hookit feeds $HKT">
        <svg viewBox="0 0 1080 720" className="docs-cycle-svg">
          <defs>
            <marker id="docs-cycle-w" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#f4f4f5" />
            </marker>
          </defs>

          <text x="36" y="40" fill="#71717a" fontSize="11" letterSpacing="2.2">
            LAUNCHED ON HOOKIT
          </text>
          <text x="250" y="40" fill="#71717a" fontSize="11" letterSpacing="2.2">
            SHARE OF THE 1%
          </text>
          <Pct x={250} y={72} value="60%" label="Creator" color="#c084fc" />
          <Pct x={430} y={72} value="10%" label="$HKT" color="#22d3ee" />
          <Pct x={590} y={72} value="30%" label="Protocol" color="#facc15" />

          <Chip x={40} y={92} src="/brand/hookit-owl-favicon.png" label="$HKT" />
          <EthChip x={16} y={172} />
          <MemeChip x={68} y={172} label="meme1" fill={MEME_COLORS[0]} />
          <MemeChip x={16} y={252} label="meme2" fill={MEME_COLORS[1]} />
          <MemeChip x={68} y={252} label="meme3" fill={MEME_COLORS[2]} />
          <MemeChip x={40} y={332} label="meme4" fill={MEME_COLORS[3]} />

          <path d="M 86 115 C 150 130, 190 230, 200 268" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 62 195 C 140 220, 180 255, 200 276" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 114 195 C 160 230, 185 265, 200 280" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 62 275 C 140 285, 180 285, 200 288" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 114 275 C 160 290, 185 295, 200 292" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 86 355 C 155 340, 185 320, 200 304" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

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

          <Chip x={40} y={428} src="/brand/quotrons-mark.png" label="wStock" />
          <Chip x={16} y={508} src="/pairing/usdg.png" label="USDG" size={32} />
          <Chip x={54} y={508} src="/pairing/wnvdax.svg" label="NVDA" size={32} />
          <Chip x={92} y={508} src="/pairing/waaplx.svg" label="AAPL" size={32} />
          <Chip x={130} y={508} src="/pairing/wtslax.png" label="TSLA" size={32} />
          <Chip x={16} y={572} src="/pairing/wspyx.svg" label="SPY" size={32} />
          <Chip x={54} y={572} src="/pairing/wgooglx.svg" label="GOOG" size={32} />
          <Chip x={92} y={572} src="/pairing/wamznx.svg" label="AMZN" size={32} />
          <Chip x={130} y={572} src="/pairing/wnflxx.svg" label="NFLX" size={32} />

          <path d="M 414 268 C 430 170, 390 122, 448 112" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <path d="M 414 292 C 450 292, 490 292, 486 292" fill="none" stroke="#f4f4f5" strokeWidth="2.6" markerEnd="url(#docs-cycle-w)" />
          <path d="M 360 338 C 380 430, 400 488, 448 500" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />

          <rect x="452" y="82" width="168" height="64" rx="14" fill="#111" stroke="#c084fc" strokeOpacity="0.55" />
          <text x="468" y="108" fill="#fff" fontSize="13" fontWeight="700">
            Creator 60%
          </text>
          <text x="468" y="128" fill="#a1a1aa" fontSize="11">
            Escrow, vest, or pot
          </text>

          <circle cx="560" cy="300" r="74" fill="#0a0a0a" stroke="#22d3ee" strokeWidth="2.4" />
          <image href="/brand/hookit-owl-favicon.png" x="528" y="248" width="64" height="64" />
          <text x="560" y="328" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            $HKT
          </text>
          <text x="560" y="346" textAnchor="middle" fill="#67e8f9" fontSize="11">
            Hold one, get all
          </text>
          {PILE_STOCKS.map((item) => (
            <Chip key={`${item.src}-${item.x}`} x={item.x} y={item.y} src={item.src} size={item.size} />
          ))}
          {PILE_MEMES.map((item) => (
            <MemeChip key={item.label} x={item.x} y={item.y} label={item.label} fill={item.fill} size={22} />
          ))}
          <EthChip x={548} y={226} size={22} />

          <rect x="452" y="484" width="168" height="44" rx="14" fill="#111" stroke="#facc15" strokeOpacity="0.55" />
          <text x="468" y="512" fill="#fff" fontSize="13" fontWeight="700">
            Protocol 30%
          </text>

          <path d="M 634 280 C 710 230, 760 180, 798 166" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <rect x="802" y="128" width="236" height="78" rx="16" fill="#111" stroke="#22d3ee" strokeOpacity="0.5" />
          <image href="/brand/hookit-owl-favicon.png" x="818" y="146" width="36" height="36" />
          <text x="864" y="160" fill="#fff" fontSize="13" fontWeight="700">
            Live $HKT holders
          </text>
          <text x="864" y="180" fill="#a1a1aa" fontSize="11">
            10% buys that ticker
          </text>
          <text x="864" y="196" fill="#67e8f9" fontSize="11">
            Epoch push, pro-rata
          </text>

          <path d="M 620 506 C 720 520, 820 490, 802 436" fill="none" stroke="#f4f4f5" strokeWidth="2.2" markerEnd="url(#docs-cycle-w)" />
          <rect x="802" y="380" width="236" height="78" rx="16" fill="#111" stroke="#facc15" strokeOpacity="0.5" />
          <image href="/brand/hookit-owl-favicon.png" x="818" y="398" width="36" height="36" />
          <text x="864" y="412" fill="#fff" fontSize="13" fontWeight="700">
            Buy $HKT and burn
          </text>
          <text x="864" y="432" fill="#a1a1aa" fontSize="11">
            80% of protocol cut
          </text>
          <text x="864" y="448" fill="#fde68a" fontSize="11">
            Supply goes down
          </text>

          <path
            d="M 920 458 C 1000 480, 1020 340, 634 330"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="2.2"
            strokeDasharray="6 6"
            markerEnd="url(#docs-cycle-w)"
          />
          <text x="980" y="410" fill="#f4f4f5" fontSize="11" fontWeight="700">
            Buy $HKT again
          </text>

          <path d="M 307 338 C 307 400, 307 560, 307 618" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <rect x="214" y="622" width="186" height="58" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          <text x="230" y="646" fill="#fff" fontSize="12" fontWeight="700">
            Hook tax
          </text>
          <text x="230" y="664" fill="#a1a1aa" fontSize="11">
            Optional. Fills the pot.
          </text>
          <path d="M 400 651 C 430 651, 460 651, 488 651" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <rect x="492" y="608" width="340" height="96" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          <HookTaxMark x={516} y={618} id="auto-burn" color="#dc2626" label="Burn" />
          <HookTaxMark x={588} y={618} id="backed-floor" color="#f43f5e" label="Floor" />
          <HookTaxMark x={660} y={618} id="deepen-lps" color="#10b981" label="Deepen" />
          <HookTaxMark x={732} y={618} id="holder-airdrop" color="#f59e0b" label="Airdrop" />
          <text x="662" y="694" textAnchor="middle" fill="#a1a1aa" fontSize="10">
            Skips the 60 / 10 / 30 split
          </text>
        </svg>
      </div>
      <p className="docs-schema-note">
        Every Master and graduated Classic swap pays the 1% in quote. The 10% $HKT slice cannot be
        removed. More volume, more dollars for $HKT holders.
      </p>
    </figure>
  );
}
