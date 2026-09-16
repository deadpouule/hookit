function Chip({
  x,
  y,
  src,
  label,
}: {
  x: number;
  y: number;
  src?: string;
  label: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="46" height="46" rx="13" fill="#141414" stroke="rgb(255 255 255 / 0.14)" />
      {src ? <image href={src} x={x + 7} y={y + 7} width="32" height="32" /> : null}
      <text x={x + 23} y={y + 62} textAnchor="middle" fill="#a1a1aa" fontSize="10">
        {label}
      </text>
    </g>
  );
}

function EthChip({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="46" height="46" rx="13" fill="#627eea" stroke="rgb(255 255 255 / 0.14)" />
      <path
        transform={`translate(${x + 11} ${y + 8}) scale(1.05)`}
        fill="#fff"
        d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
      />
      <text x={x + 23} y={y + 62} textAnchor="middle" fill="#a1a1aa" fontSize="10">
        ETH
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

export function DocsCycleArt() {
  return (
    <figure className="docs-schema docs-schema--wide">
      <figcaption>Every swap feeds $HKT</figcaption>
      <p className="docs-map-kicker">Token buybacks. Holder drops. A connected fee cycle.</p>
      <div className="docs-cycle" role="img" aria-label="Every launch and every swap on hookit feeds $HKT">
        <svg viewBox="0 0 1080 640" className="docs-cycle-svg">
          <defs>
            <marker id="docs-cycle-w" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#f4f4f5" />
            </marker>
            <marker id="docs-cycle-c" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#22d3ee" />
            </marker>
            <marker id="docs-cycle-g" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#facc15" />
            </marker>
            <marker id="docs-cycle-v" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0 1.1 L11 6 L0 10.9 L2.8 6 Z" fill="#c084fc" />
            </marker>
          </defs>

          <text x="36" y="46" fill="#71717a" fontSize="11" letterSpacing="2.2">
            LAUNCHED ON HOOKIT
          </text>
          <text x="250" y="46" fill="#71717a" fontSize="11" letterSpacing="2.2">
            SHARE OF THE 1%
          </text>
          <Pct x={250} y={78} value="60%" label="Creator" color="#c084fc" />
          <Pct x={430} y={78} value="10%" label="$HKT" color="#22d3ee" />
          <Pct x={590} y={78} value="30%" label="Protocol" color="#facc15" />

          <Chip x={40} y={132} src="/brand/hookit-owl-favicon.png" label="$HKT" />
          <EthChip x={22} y={214} />
          <Chip x={70} y={214} src="/pairing/usdg.png" label="USDG" />
          <Chip x={22} y={296} src="/pairing/wnvdax.svg" label="NVDA" />
          <Chip x={70} y={296} src="/pairing/waaplx.svg" label="AAPL" />
          <Chip x={22} y={378} src="/pairing/wtslax.png" label="TSLA" />
          <Chip x={70} y={378} src="/brand/uniswap-mark.png" label="v4" />
          <Chip x={46} y={460} src="/brand/quotrons-mark.png" label="wStock" />

          <path d="M 92 155 C 150 155, 190 250, 216 300" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 68 237 C 140 250, 190 280, 216 310" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 68 319 C 150 330, 190 325, 216 320" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 68 401 C 150 390, 190 350, 216 330" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <path d="M 92 483 C 160 460, 200 380, 216 338" fill="none" stroke="#f4f4f5" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />

          <circle cx="270" cy="320" r="54" fill="#0a0a0a" stroke="#f4f4f5" strokeWidth="2" />
          <text x="270" y="314" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="800">
            1%
          </text>
          <text x="270" y="336" textAnchor="middle" fill="#a1a1aa" fontSize="11">
            quote fee
          </text>
          <text x="270" y="392" textAnchor="middle" fill="#71717a" fontSize="11">
            MasterLaunchHook
          </text>

          <path d="M 292 278 C 340 180, 390 130, 448 118" fill="none" stroke="#c084fc" strokeWidth="2.4" markerEnd="url(#docs-cycle-v)" />
          <path d="M 324 320 C 380 320, 430 320, 488 320" fill="none" stroke="#22d3ee" strokeWidth="2.8" markerEnd="url(#docs-cycle-c)" />
          <path d="M 292 360 C 340 450, 390 500, 448 512" fill="none" stroke="#facc15" strokeWidth="2.4" markerEnd="url(#docs-cycle-g)" />

          <rect x="452" y="88" width="168" height="64" rx="14" fill="#111" stroke="#c084fc" strokeOpacity="0.55" />
          <text x="468" y="114" fill="#fff" fontSize="13" fontWeight="700">
            Creator 60%
          </text>
          <text x="468" y="134" fill="#a1a1aa" fontSize="11">
            Escrow, vest, or pot
          </text>

          <circle cx="560" cy="320" r="74" fill="#0a0a0a" stroke="#22d3ee" strokeWidth="2.4" />
          <image href="/brand/hookit-owl-favicon.png" x="528" y="268" width="64" height="64" />
          <text x="560" y="348" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            $HKT
          </text>
          <text x="560" y="366" textAnchor="middle" fill="#67e8f9" fontSize="11">
            Hold one, get all
          </text>

          <rect x="452" y="488" width="168" height="64" rx="14" fill="#111" stroke="#facc15" strokeOpacity="0.55" />
          <text x="468" y="514" fill="#fff" fontSize="13" fontWeight="700">
            Protocol 30%
          </text>
          <text x="468" y="534" fill="#a1a1aa" fontSize="11">
            20% ops · 80% buyback
          </text>

          <path d="M 634 300 C 710 250, 760 200, 798 186" fill="none" stroke="#22d3ee" strokeWidth="2.4" markerEnd="url(#docs-cycle-c)" />
          <rect x="802" y="148" width="236" height="78" rx="16" fill="#111" stroke="#22d3ee" strokeOpacity="0.5" />
          <image href="/brand/hookit-owl-favicon.png" x="818" y="166" width="36" height="36" />
          <text x="864" y="180" fill="#fff" fontSize="13" fontWeight="700">
            Live $HKT holders
          </text>
          <text x="864" y="200" fill="#a1a1aa" fontSize="11">
            10% buys that ticker
          </text>
          <text x="864" y="216" fill="#67e8f9" fontSize="11">
            Epoch push, pro-rata
          </text>

          <path d="M 620 520 C 720 530, 820 500, 802 456" fill="none" stroke="#facc15" strokeWidth="2.4" markerEnd="url(#docs-cycle-g)" />
          <rect x="802" y="400" width="236" height="78" rx="16" fill="#111" stroke="#facc15" strokeOpacity="0.5" />
          <image href="/brand/hookit-owl-favicon.png" x="818" y="418" width="36" height="36" />
          <text x="864" y="432" fill="#fff" fontSize="13" fontWeight="700">
            Buy $HKT and burn
          </text>
          <text x="864" y="452" fill="#a1a1aa" fontSize="11">
            80% of protocol cut
          </text>
          <text x="864" y="468" fill="#fde68a" fontSize="11">
            Supply goes down
          </text>

          <path
            d="M 920 478 C 1000 500, 1020 360, 634 350"
            fill="none"
            stroke="#facc15"
            strokeWidth="2.2"
            strokeDasharray="6 6"
            markerEnd="url(#docs-cycle-g)"
          />
          <text x="980" y="430" fill="#facc15" fontSize="11" fontWeight="700">
            Buy $HKT again
          </text>

          <path d="M 270 374 C 270 430, 270 500, 270 548" fill="none" stroke="#a1a1aa" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <rect x="186" y="552" width="168" height="58" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          <text x="202" y="576" fill="#fff" fontSize="12" fontWeight="700">
            Hook tax 0 to 9%
          </text>
          <text x="202" y="594" fill="#a1a1aa" fontSize="11">
            Optional. Fills the pot.
          </text>
          <path d="M 354 581 C 430 581, 500 581, 548 581" fill="none" stroke="#a1a1aa" strokeWidth="1.8" markerEnd="url(#docs-cycle-w)" />
          <rect x="552" y="552" width="250" height="58" rx="14" fill="#111" stroke="rgb(255 255 255 / 0.12)" />
          <text x="568" y="576" fill="#fff" fontSize="12" fontWeight="700">
            Auto-Burn · Floor · Deepen · Airdrop
          </text>
          <text x="568" y="594" fill="#a1a1aa" fontSize="11">
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
