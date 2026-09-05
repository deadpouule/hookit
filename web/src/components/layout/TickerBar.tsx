import { getNetworkLabel } from "@/lib/chains";

const ITEMS = [
  `Live on ${getNetworkLabel()}`,
  "$5,000 launch FDV",
  "Locked LP · no migration",
  "Quote-only swap fees",
  "Master modules or custom Solidity",
  "Anti-snipe · Floor · Anti-MEV",
];

export function TickerBar() {
  const line = [...ITEMS, ...ITEMS];
  return (
    <div className="relative z-40 overflow-hidden border-b border-white/[0.06] bg-white/[0.03] py-1.5">
      <div className="ticker-track flex w-max gap-8 whitespace-nowrap px-4 text-[11px] font-medium tracking-wide text-zinc-400">
        {line.map((item, i) => (
          <span key={`${item}-${i}`} className="inline-flex items-center gap-8">
            <span className="text-neon-lime">●</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
