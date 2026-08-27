"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Launch V4 with programmable hooks",
  "Tokenized stocks, ETH and dollar curves hooks.",
];

const TYPE_MS = 70;
const DELETE_MS = 40;
const HOLD_MS = 3500;

export function TypewriterTitle() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "deleting">("typing");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setText(LINES[0]);
      return;
    }

    const line = LINES[index];
    let timeout = 0;

    if (phase === "typing") {
      if (text.length < line.length) {
        timeout = window.setTimeout(() => {
          setText(line.slice(0, text.length + 1));
        }, TYPE_MS);
      } else {
        timeout = window.setTimeout(() => setPhase("deleting"), HOLD_MS);
      }
    } else if (text.length > 0) {
      timeout = window.setTimeout(() => {
        setText(text.slice(0, -1));
      }, DELETE_MS);
    } else {
      setIndex((current) => (current + 1) % LINES.length);
      setPhase("typing");
    }

    return () => window.clearTimeout(timeout);
  }, [index, phase, text]);

  return (
    <h1 className="hero-typewriter" aria-live="polite">
      <span className="hero-prompt">~$</span>
      <span className="hero-typed">{text}</span>
      <span className="hero-cursor" aria-hidden>
        |
      </span>
    </h1>
  );
}
