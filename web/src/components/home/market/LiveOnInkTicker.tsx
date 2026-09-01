import Image from "next/image";

const SEGMENT_COUNT = 12;

function LiveOnInkUnit() {
  return (
    <span className="live-on-ink-ticker__unit inline-flex shrink-0 items-center">
      <Image
        src="/brand/ink-ticker.png"
        alt=""
        width={26}
        height={26}
        className="live-on-ink-ticker__logo"
        draggable={false}
      />
      <span className="live-on-ink-ticker__label">
        <span className="live-on-ink-ticker__accent live-on-ink-ticker__accent--ink">LIVE</span>
        <span className="live-on-ink-ticker__on"> ON INK</span>
      </span>
    </span>
  );
}

function BuildOnUniswapUnit() {
  return (
    <span className="live-on-ink-ticker__unit inline-flex shrink-0 items-center">
      <Image
        src="/brand/uniswap-logo.png"
        alt=""
        width={34}
        height={34}
        className="live-on-ink-ticker__logo live-on-ink-ticker__logo--uniswap"
        draggable={false}
      />
      <span className="live-on-ink-ticker__label">
        <span className="live-on-ink-ticker__accent live-on-ink-ticker__accent--uniswap">build</span>
        <span className="live-on-ink-ticker__on"> ON UNISWAP</span>
      </span>
    </span>
  );
}

export function LiveOnInkTicker() {
  const segments = Array.from({ length: SEGMENT_COUNT * 2 }, (_, i) => i);

  return (
    <div className="live-on-ink-ticker" aria-hidden>
      <div className="live-on-ink-ticker__track ticker-track flex w-max items-center whitespace-nowrap">
        {segments.map((i) =>
          i % 2 === 0 ? <LiveOnInkUnit key={i} /> : <BuildOnUniswapUnit key={i} />,
        )}
      </div>
    </div>
  );
}
