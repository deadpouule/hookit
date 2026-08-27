import { getNetworkLabel } from "@/lib/chains";

const ITEMS = [
  "Launch with programmable hooks",
  "Discover, reuse, and publish hooks",
  "Anti-snipe · Floor · Anti-MEV",
  "Quote-only swap fees",
  "Master modules or custom Solidity",
  `Live on ${getNetworkLabel()}`,
];

export function HomeTicker() {
  const line = [...ITEMS, ...ITEMS];
  return (
    <div className="relative z-40 overflow-hidden border-b border-white/[0.06] bg-black py-1.5">
      <div className="ticker-track flex w-max gap-8 whitespace-nowrap px-4 text-[11px] font-medium tracking-wide text-white">
        {line.map((item, i) => (
          <span key={`${item}-${i}`} className="inline-flex items-center gap-8">
            <span aria-hidden>◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
