"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { BuiltOnUniswapBadge } from "@/components/brand/BuiltOnUniswapBadge";

type TextSegment = { kind: "text"; value: string };
type LogoSegment = { kind: "logo"; id: "uniswap" | "eth" | "usdg" | "mstr" | "aapl" | "tsla" };
type LineSegment = TextSegment | LogoSegment;

type TypewriterLine = {
  segments: LineSegment[];
};

const STOCK_LOGO_IDS = new Set<LogoSegment["id"]>(["mstr", "aapl", "tsla"]);

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
      { kind: "logo", id: "mstr" },
      { kind: "logo", id: "aapl" },
      { kind: "logo", id: "tsla" },
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
const HOLD_MS_BY_LINE = [5500, 3500];

function lineLength(line: TypewriterLine): number {
  return line.segments.reduce(
    (sum, segment) => sum + (segment.kind === "text" ? segment.value.length : 1),
    0,
  );
}

function HeroInlineMark({ id }: { id: LogoSegment["id"] }) {
  if (id === "uniswap") {
    return (
      <BuiltOnUniswapBadge variant="hero" className="hero-uniswap-badge" />
    );
  }

  if (id === "mstr") {
    return (
      <span className="hero-typewriter-mark hero-typewriter-mark--stock hero-typewriter-mark--mstr" aria-hidden>
        <Image
          src="/pairing/wmstrx.png"
          alt=""
          width={46}
          height={46}
          className="hero-typewriter-mark__photo"
          draggable={false}
        />
      </span>
    );
  }

  if (id === "aapl") {
    return (
      <span className="hero-typewriter-mark hero-typewriter-mark--stock hero-typewriter-mark--aapl" aria-hidden>
        <svg viewBox="0 0 24 24" className="hero-typewriter-mark__glyph">
          <path
            fill="#111"
            d="M16.2 12.4c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1 1-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.1 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.6-3.9Zm-2.4-7c.7-.8 1.1-1.9 1-3-.9.1-2 .7-2.7 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2-.6 2.7-1.4Z"
          />
        </svg>
      </span>
    );
  }

  if (id === "tsla") {
    return (
      <span className="hero-typewriter-mark hero-typewriter-mark--stock hero-typewriter-mark--tsla" aria-hidden>
        <Image
          src="/pairing/wtslax.png"
          alt=""
          width={46}
          height={46}
          className="hero-typewriter-mark__photo"
          draggable={false}
        />
      </span>
    );
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
        className="hero-typewriter-mark__photo"
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
          <span key={`stocks-${nodes.length}`} className="hero-typewriter-stock-group">
            {stockIds.map((id) => (
              <HeroInlineMark key={id} id={id} />
            ))}
          </span>,
        );
        remaining -= stockIds.length;
        index = cursor - 1;
        continue;
      }
    }

    nodes.push(
      <HeroInlineMark key={`${segment.id}-${nodes.length}`} id={segment.id} />,
    );
    remaining -= 1;
  }

  return nodes;
}

export function TypewriterTitle() {
  const [index, setIndex] = useState(0);
  const [typedCount, setTypedCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "deleting">("typing");

  useEffect(() => {
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
  }, [index, phase, typedCount]);

  return (
    <h1 className="hero-typewriter" aria-live="polite">
      <span className="hero-prompt">~$</span>
      <span className="hero-typed">{renderTypedLine(LINES[index], typedCount)}</span>
      <span className="hero-cursor" aria-hidden>
        |
      </span>
    </h1>
  );
}
