"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BuiltOnUniswapBadge } from "@/components/brand/BuiltOnUniswapBadge";

type TextSegment = { kind: "text"; value: string };
type LogoSegment = { kind: "logo" };
type LineSegment = TextSegment | LogoSegment;

type TypewriterLine = {
  segments: LineSegment[];
};

const LINES: TypewriterLine[] = [
  {
    segments: [
      { kind: "text", value: "Launch programmable hooks V4 " },
      { kind: "logo" },
      { kind: "text", value: " build on uniswap" },
    ],
  },
  {
    segments: [{ kind: "text", value: "Tokenized stocks, ETH and dollar curves hooks." }],
  },
];

const TYPE_MS = 70;
const DELETE_MS = 40;
const HOLD_MS = 3500;

function lineLength(line: TypewriterLine): number {
  return line.segments.reduce(
    (sum, segment) => sum + (segment.kind === "text" ? segment.value.length : 1),
    0,
  );
}

function renderTypedLine(line: TypewriterLine, typedCount: number) {
  let remaining = typedCount;
  const nodes: ReactNode[] = [];

  for (const segment of line.segments) {
    if (remaining <= 0) break;

    if (segment.kind === "text") {
      const take = Math.min(remaining, segment.value.length);
      if (take > 0) {
        nodes.push(segment.value.slice(0, take));
      }
      remaining -= take;
      continue;
    }

    nodes.push(
      <BuiltOnUniswapBadge
        key="uniswap-inline"
        variant="inline"
        text="build on uniswap"
        className="hero-uniswap-badge"
      />,
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
        timeout = window.setTimeout(() => setPhase("deleting"), HOLD_MS);
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
