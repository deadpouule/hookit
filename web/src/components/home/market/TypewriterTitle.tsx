"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  BuiltOnUniswapBadge,
  UNISWAP_BADGE_LABEL,
} from "@/components/brand/BuiltOnUniswapBadge";
import {
  PoweredByQuotronsBadge,
  QUOTRONS_BADGE_LABEL,
} from "@/components/brand/PoweredByQuotronsBadge";
import type { PairingTokenId } from "@/lib/pairing-tokens";

import { PairingLogoStack, STOCK_PAIRING_IDS } from "./PairingLogoStack";
import { PairingMark } from "@/components/launch/PairingMark";

type TextSegment = { kind: "text"; value: string };
type LogoSegment = { kind: "logo"; id: "uniswap" | "quotrons" | PairingTokenId };
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
      { kind: "logo", id: "quotrons" },
    ],
  },
];

const TYPE_MS = 70;
const DELETE_MS = 40;
const HOLD_MS_BY_LINE = [5500, 5500];

function badgeLabel(id: LogoSegment["id"]): string | null {
  if (id === "uniswap") return UNISWAP_BADGE_LABEL;
  if (id === "quotrons") return QUOTRONS_BADGE_LABEL;
  return null;
}

function segmentLength(segment: LineSegment): number {
  if (segment.kind === "text") return segment.value.length;
  const label = badgeLabel(segment.id);
  return label ? 1 + label.length : 1;
}

function lineLength(line: TypewriterLine): number {
  return line.segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
}

function UsdgMark() {
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

function HeroBadge({
  id,
  typedChars,
}: {
  id: "uniswap" | "quotrons";
  typedChars: number;
}) {
  const label = badgeLabel(id) ?? "";
  const logoShown = typedChars > 0;
  if (!logoShown) return null;
  const typedText = label.slice(0, Math.max(0, typedChars - 1));
  const showCaret = typedChars > 0 && typedChars < 1 + label.length;

  if (id === "uniswap") {
    return (
      <BuiltOnUniswapBadge
        variant="hero"
        className="hero-uniswap-badge"
        typedText={typedText}
        showCaret={showCaret}
      />
    );
  }

  return (
    <PoweredByQuotronsBadge
      variant="hero"
      className="hero-quotrons-badge"
      typedText={typedText}
      showCaret={showCaret}
    />
  );
}

function HeroInlineMark({ id }: { id: LogoSegment["id"] }) {
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

  return <UsdgMark />;
}

function renderTypedLine(line: TypewriterLine, typedCount: number) {
  let remaining = typedCount;
  const nodes: ReactNode[] = [];

  for (let index = 0; index < line.segments.length; index += 1) {
    const segment = line.segments[index];
    if (remaining <= 0) break;

    const next = line.segments[index + 1];
    const after = line.segments[index + 2];
    if (
      segment.kind === "text" &&
      next?.kind === "logo" &&
      next.id === "usdg" &&
      after?.kind === "logo" &&
      after.id === "quotrons"
    ) {
      const dollar = segment.value;
      const dollarTake = Math.min(remaining, dollar.length);
      remaining -= dollarTake;
      const usdgOn = remaining > 0;
      if (usdgOn) remaining -= 1;
      const quotronsTicks = 1 + QUOTRONS_BADGE_LABEL.length;
      const quotronsTake = usdgOn ? Math.min(remaining, quotronsTicks) : 0;
      remaining -= quotronsTake;

      nodes.push(
        <span key="usdg-quotrons" className="hero-usdg-quotrons">
          <span className="hero-usdg-row">
            {dollar.slice(0, dollarTake)}
            {usdgOn ? <UsdgMark /> : null}
          </span>
          {quotronsTake > 0 ? (
            <span className="hero-quotrons-wrap">
              <HeroBadge id="quotrons" typedChars={quotronsTake} />
            </span>
          ) : null}
        </span>,
      );
      index += 2;
      continue;
    }

    if (segment.kind === "text") {
      const take = Math.min(remaining, segment.value.length);
      if (take > 0) {
        nodes.push(segment.value.slice(0, take));
      }
      remaining -= take;
      continue;
    }

    const label = badgeLabel(segment.id);
    if (label && (segment.id === "uniswap" || segment.id === "quotrons")) {
      const ticks = 1 + label.length;
      const take = Math.min(remaining, ticks);
      nodes.push(
        <HeroBadge key={`${segment.id}-${nodes.length}`} id={segment.id} typedChars={take} />,
      );
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

function hideOuterCursor(line: TypewriterLine, typedCount: number): boolean {
  let remaining = typedCount;
  for (const segment of line.segments) {
    const len = segmentLength(segment);
    if (remaining <= 0) return false;
    const label = segment.kind === "logo" ? badgeLabel(segment.id) : null;
    if (label && remaining > 0 && remaining < len) return true;
    remaining -= Math.min(remaining, len);
  }
  return false;
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

  const hideCursor = hideOuterCursor(LINES[index], typedCount);

  return (
    <h1 className="hero-typewriter" aria-live="polite">
      <span className="hero-prompt">~$</span>
      <span className="hero-typed">{renderTypedLine(LINES[index], typedCount)}</span>
      {hideCursor ? null : (
        <span className="hero-cursor" aria-hidden>
          |
        </span>
      )}
    </h1>
  );
}
