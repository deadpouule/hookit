"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Skip the load intro if the logo remounts after the first visit. */
let logoIntroPlayed = false;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function HookitFunLogo({ className }: { className?: string }) {
  const [skipIntro] = useState(() => logoIntroPlayed);
  const [blinkNonce, setBlinkNonce] = useState(0);
  const idleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const blink = useCallback(() => {
    if (prefersReducedMotion()) return;
    setBlinkNonce((n) => n + 1);
  }, []);

  const stopIdle = useCallback(() => {
    if (idleRef.current != null) {
      window.clearInterval(idleRef.current);
      idleRef.current = null;
    }
  }, []);

  const startIdle = useCallback(() => {
    stopIdle();
    if (prefersReducedMotion()) return;
    idleRef.current = setInterval(blink, 5000);
  }, [blink, stopIdle]);

  useEffect(() => {
    logoIntroPlayed = true;
    startIdle();
    return stopIdle;
  }, [startIdle, stopIdle]);

  const onPointerEnter = () => {
    blink();
    startIdle();
  };

  return (
    <span
      className={cn(
        "hookit-fun-logo hookit-logo-motion",
        skipIntro && "hookit-logo-motion--no-intro",
        className,
      )}
      role="img"
      aria-label="hookit.fun"
      onPointerEnter={onPointerEnter}
    >
      <Image
        src="/brand/hookit-type.png"
        alt=""
        fill
        sizes="(min-width: 640px) 184px, 145px"
        className="hookit-logo-layer hookit-logo-type"
        priority
        draggable={false}
      />
      <span className="hookit-logo-owl-wrap">
        <Image
          src="/brand/hookit-owl.png"
          alt=""
          fill
          sizes="(min-width: 640px) 184px, 145px"
          className="hookit-logo-layer hookit-logo-owl"
          priority
          draggable={false}
        />
        {blinkNonce > 0 ? (
          <>
            <span key={`l-${blinkNonce}`} className="hookit-logo-lid hookit-logo-lid--l" />
            <span key={`r-${blinkNonce}`} className="hookit-logo-lid hookit-logo-lid--r" />
          </>
        ) : null}
      </span>
      <Image
        src="/brand/hookit-fun-suffix.png"
        alt=""
        fill
        sizes="(min-width: 640px) 184px, 145px"
        className="hookit-logo-layer hookit-logo-fun"
        priority
        draggable={false}
      />
    </span>
  );
}
