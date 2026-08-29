import Image from "next/image";

const SEGMENT_COUNT = 14;

function LiveOnInkSegment() {
  return (
    <span className="live-on-ink-ticker__segment inline-flex items-center gap-2.5">
      <Image
        src="/brand/ink-ticker.png"
        alt=""
        width={20}
        height={20}
        className="live-on-ink-ticker__logo"
        draggable={false}
      />
      <span className="live-on-ink-ticker__label">
        <span className="live-on-ink-ticker__live">LIVE</span>
        <span className="live-on-ink-ticker__on"> ON INK</span>
      </span>
    </span>
  );
}

export function LiveOnInkTicker() {
  const segments = Array.from({ length: SEGMENT_COUNT * 2 }, (_, i) => i);

  return (
    <div className="live-on-ink-ticker" aria-hidden>
      <div className="live-on-ink-ticker__track ticker-track flex w-max items-center whitespace-nowrap">
        {segments.map((i) => (
          <LiveOnInkSegment key={i} />
        ))}
      </div>
    </div>
  );
}
