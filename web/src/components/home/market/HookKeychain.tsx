"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const SILVER = "#f4f7fb";
const STEEL = "#c5cedd";

function HouseKey() {
  return (
    <path
      fill={SILVER}
      fillRule="evenodd"
      d="M0-17.5a17.5 17.5 0 1 1 0 35 17.5 17.5 0 0 1 0-35Zm0 8.6a8.9 8.9 0 1 0 0 17.8 8.9 8.9 0 0 0 0-17.8ZM-4 16.8h8v50h12.5v6.2H4V79h12.5v6.2H4V91.4h12.5v6.2H4v8.4h-8z"
    />
  );
}

function CarFob() {
  return (
    <g>
      <path
        fill={SILVER}
        fillRule="evenodd"
        d="M-24-15h48a12 12 0 0 1 12 12v46a13 13 0 0 1-13 13h-46a13 13 0 0 1-13-13v-46a12 12 0 0 1 12-12ZM0-8.2a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4ZM-4 56h8v38h11v5.6H4V105h11v5.6H4v7.2h-8z"
      />
      <circle cx="-9" cy="36" r="4.1" fill={STEEL} />
      <circle cx="0" cy="36" r="4.1" fill="#b7c0d0" />
      <circle cx="9" cy="36" r="4.1" fill={STEEL} />
    </g>
  );
}

function Padlock() {
  return (
    <g>
      <path
        fill={SILVER}
        fillRule="evenodd"
        d="M0-14.5a14.5 14.5 0 1 1 0 29 14.5 14.5 0 0 1 0-29Zm0 7.2a7.3 7.3 0 1 0 0 14.6 7.3 7.3 0 0 0 0-14.6ZM-19 16h38a7 7 0 0 1 7 7v30a7 7 0 0 1-7 7h-38a7 7 0 0 1-7-7V23a7 7 0 0 1 7-7Z"
      />
      <path
        fill={STEEL}
        d="M0 32.5a5.2 5.2 0 0 1 2.5 9.8v9.4c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5v-9.4A5.2 5.2 0 0 1 0 32.5Z"
      />
    </g>
  );
}

function SwingingKeyMotion({
  swing,
  duration,
  delay,
  children,
}: {
  swing: [number, number, number];
  duration: number;
  delay: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGGElement>(null);
  const [origin, setOrigin] = useState({ x: "0px", y: "0px" });

  useLayoutEffect(() => {
    const box = ref.current?.getBBox();
    if (!box) return;
    setOrigin({ x: `${-box.x}px`, y: `${-box.y}px` });
  }, []);

  return (
    <motion.g
      ref={ref}
      style={{
        transformBox: "fill-box",
        originX: origin.x,
        originY: origin.y,
      }}
      animate={reduce ? { rotate: 0 } : { rotate: swing }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.g>
  );
}

function SwingingKey({
  x,
  y,
  swing,
  duration,
  delay,
  children,
}: {
  x: number;
  y: number;
  swing: [number, number, number];
  duration: number;
  delay: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <g transform={`translate(${x} ${y})`}>
      {mounted ? (
        <SwingingKeyMotion swing={swing} duration={duration} delay={delay}>
          {children}
        </SwingingKeyMotion>
      ) : (
        <g>{children}</g>
      )}
    </g>
  );
}

export function HookKeychain() {
  const glow = "hook-keychain-glow";
  const metal = "hook-keychain-metal";

  const ring = { cx: 200, cy: 386, r: 52 };

  return (
    <svg
      viewBox="0 0 400 560"
      width={288}
      height={288}
      className="h-72 w-72 shrink-0 overflow-visible"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={metal} x1="70" y1="40" x2="320" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#e8eef6" />
          <stop offset="100%" stopColor="#c5cedd" />
        </linearGradient>
        <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glow})`}>
        <path
          d="M278 102C278 58 246 40 200 40C118 40 70 104 70 200C70 296 118 360 200 360C246 360 278 342 278 298"
          stroke={`url(#${metal})`}
          strokeWidth="22"
          strokeLinecap="round"
        />
        <path
          d="M278 298C288 294 298 282 298 266"
          stroke={`url(#${metal})`}
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path d="M298 118V250" stroke={`url(#${metal})`} strokeWidth="16" strokeLinecap="round" />
        <rect
          x="276"
          y="92"
          width="46"
          height="44"
          rx="8"
          fill="#f8fafc"
          stroke="#c5cedd"
          strokeWidth="1.6"
        />
        <path
          d="M92 118C108 72 148 54 200 54C236 54 262 70 270 104"
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      <SwingingKey
        x={ring.cx - ring.r * Math.sin((42 * Math.PI) / 180)}
        y={ring.cy + ring.r * Math.cos((42 * Math.PI) / 180)}
        swing={[-20, 16, -20]}
        duration={2.15}
        delay={0}
      >
        <HouseKey />
      </SwingingKey>
      <SwingingKey
        x={ring.cx}
        y={ring.cy + ring.r}
        swing={[-16, 22, -16]}
        duration={2.55}
        delay={0.2}
      >
        <CarFob />
      </SwingingKey>
      <SwingingKey
        x={ring.cx + ring.r * Math.sin((42 * Math.PI) / 180)}
        y={ring.cy + ring.r * Math.cos((42 * Math.PI) / 180)}
        swing={[18, -19, 18]}
        duration={2.35}
        delay={0.38}
      >
        <Padlock />
      </SwingingKey>

      <circle
        cx={ring.cx}
        cy={ring.cy}
        r={ring.r}
        fill="none"
        stroke="white"
        strokeWidth="8"
        filter={`url(#${glow})`}
      />
    </svg>
  );
}
