import Image from "next/image";

const SEGMENT_COUNT = 12;

function LiveOnInkUnit() {
  return (
    <span className="live-on-ink-ticker__unit inline-flex shrink-0 items-center">
      <span className="live-on-ink-ticker__label">
        <span className="live-on-ink-ticker__live">LIVE</span>
        <span className="live-on-ink-ticker__on"> ON INK</span>
      </span>
      <Image
        src="/brand/ink-ticker.png"
        alt=""
        width={26}
        height={26}
        className="live-on-ink-ticker__logo"
        draggable={false}
      />
    </span>
  );
}

export function LiveOnInkTicker() {
  const segments = Array.from({ length: SEGMENT_COUNT * 2 }, (_, i) => i);

  return (
    <div className="live-on-ink-ticker" aria-hidden>
      <div className="live-on-ink-ticker__track ticker-track flex w-max items-center whitespace-nowrap">
        {segments.map((i) => (
          <LiveOnInkUnit key={i} />
        ))}
      </div>
    </div>
  );
}
