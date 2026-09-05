"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { BuiltOnUniswapBadge } from "@/components/brand/BuiltOnUniswapBadge";
import type { PairingTokenId } from "@/lib/pairing-tokens";

import { PairingLogoStack, STOCK_PAIRING_IDS } from "./PairingLogoStack";
import { PairingMark } from "@/components/launch/PairingMark";

type TextSegment = { kind: "text"; value: string };
type LogoSegment = { kind: "logo"; id: "uniswap" | PairingTokenId };
type LineSegment = TextSegment | LogoSegment;

type TypewriterLine = {
  segments: LineSegment[];
};

const STOCK_LOGO_IDS = new Set<LogoSegment["id"]>(STOCK_PAIRING_IDS);

const LINES: TypewriterLine[] = [
  {
    segments: [
      { kind: "text", value: "Launch programmable hooks V4 " },
      { kind: "logo", id: "uniswap" },
      { kind: "text", value: "." },
    ],
  },
  {
    segments: [
      { kind: "text", value: "Tokenized stocks " },
      ...STOCK_PAIRING_IDS.map((id) => ({ kind: "logo" as const, id })),
      { kind: "text", value: ", ETH " },
      { kind: "logo", id: "eth" },
      { kind: "text", value: " and Dollar " },
      { kind: "logo", id: "usdg" },
      { kind: "text", value: " curves hooks." },
    ],
  },
];

const TYPE_MS = 70;
const DELETE_MS = 40;
const HOLD_MS_BY_LINE = [5500, 5500];

function lineLength(line: TypewriterLine): number {
  return line.segments.reduce(
    (sum, segment) => sum + (segment.kind === "text" ? segment.value.length : 1),
    0,
  );
}

function HeroInlineMark({ id }: { id: LogoSegment["id"] }) {
  if (id === "uniswap") {
    return <BuiltOnUniswapBadge variant="hero" className="hero-uniswap-badge" />;
  }

  if (STOCK_LOGO_IDS.has(id)) {
    return <PairingMark id={id as PairingTokenId} />;
  }

  if (id === "eth") {
    return (
      <span className="hero-typewriter-mark hero-typewriter-mark--eth" aria-hidden>
        <svg viewBox="0 0 24 24" className="hero-typewriter-mark__glyph">
          <path
            fill="#fff"
            fillOpacity="0.92"
            d="M12 2.2 5.8 12.2 12 15.8l6.2-3.6L12 2.2Zm0 19.6 6.2-8.6L12 16.8 5.8 13.2 12 21.8Z"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="hero-typewriter-mark hero-typewriter-mark--usdg" aria-hidden>
      <Image
        src="/pairing/usdg.png"
        alt=""
        width={46}
        height={46}
        className="hero-typewriter-mark__photo h-auto w-auto"
        draggable={false}
      />
    </span>
  );
}

function renderTypedLine(line: TypewriterLine, typedCount: number) {
  let remaining = typedCount;
  const nodes: ReactNode[] = [];

  for (let index = 0; index < line.segments.length; index += 1) {
    const segment = line.segments[index];
    if (remaining <= 0) break;

    if (segment.kind === "text") {
      const take = Math.min(remaining, segment.value.length);
      if (take > 0) {
        nodes.push(segment.value.slice(0, take));
      }
      remaining -= take;
      continue;
    }

    if (STOCK_LOGO_IDS.has(segment.id)) {
      const stockIds: LogoSegment["id"][] = [];
      let cursor = index;

      while (cursor < line.segments.length) {
        const current = line.segments[cursor];
        if (current.kind !== "logo" || !STOCK_LOGO_IDS.has(current.id)) break;
        if (stockIds.length >= remaining) break;
        stockIds.push(current.id);
        cursor += 1;
      }

      if (stockIds.length > 0) {
        nodes.push(
          <PairingLogoStack
            key={`stocks-${nodes.length}`}
            ids={stockIds as PairingTokenId[]}
          />,
        );
        remaining -= stockIds.length;
        index = cursor - 1;
        continue;
      }
    }

    nodes.push(<HeroInlineMark key={`${segment.id}-${nodes.length}`} id={segment.id} />);
    remaining -= 1;
  }

  return nodes;
}

/** Static title on small screens — no mid-word typewriter orphans. */
function MobileHeroTitle() {
  return (
    <h1 className="hero-typewriter hero-typewriter--mobile md:hidden">
      <span className="hero-prompt">~$</span>
      <span className="hero-typed">
        <span className="hero-typed-line">Launch hooks on</span>{" "}
        <BuiltOnUniswapBadge
          variant="hero"
          text="Uniswap"
          className="hero-uniswap-badge"
        />
      </span>
    </h1>
  );
}

export function TypewriterTitle() {
  const [index, setIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "deleting">("typing");
  const [desktopAnim, setDesktopAnim] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktopAnim(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!desktopAnim) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTypedCount(lineLength(LINES[0]));
      return;
    }

    const line = LINES[index];
    const total = lineLength(line);
    let timeout = 0;

    if (phase === "typing") {
      if (typedCount < total) {
        timeout = window.setTimeout(() => {
          setTypedCount((current) => current + 1);
        }, TYPE_MS);
      } else {
        timeout = window.setTimeout(
          () => setPhase("deleting"),
          HOLD_MS_BY_LINE[index] ?? 3500,
        );
      }
    } else if (typedCount > 0) {
      timeout = window.setTimeout(() => {
        setTypedCount((current) => current - 1);
      }, DELETE_MS);
    } else {
      setIndex((current) => (current + 1) % LINES.length);
      setPhase("typing");
    }

    return () => window.clearTimeout(timeout);
  }, [index, phase, typedCount, desktopAnim]);

  return (
    <>
      <MobileHeroTitle />
      <h1 className="hero-typewriter hidden md:block" aria-live="polite">
        <span className="hero-prompt">~$</span>
        <span className="hero-typed">{renderTypedLine(LINES[index], typedCount)}</span>
        <span className="hero-cursor" aria-hidden>
          |
        </span>
      </h1>
    </>
  );
}
