"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { mediaUrlCandidates } from "@/lib/token-metadata";
import { cn } from "@/lib/utils";

/**
 * Token logo with IPFS gateway rotation on load failure.
 * Resets when `uri` changes so refetched metadata can recover without a full remount.
 */
export function TokenImage({
  uri,
  alt = "",
  className,
  fallback,
}: {
  uri?: string | null;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const candidates = useMemo(() => mediaUrlCandidates(uri), [uri]);
  const [srcIndex, setSrcIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setSrcIndex(0);
    setExhausted(false);
  }, [uri]);

  const src = candidates[srcIndex];
  if (!src || exhausted) return fallback ?? null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(className)}
      decoding="async"
      onError={() => {
        if (srcIndex + 1 < candidates.length) {
          setSrcIndex((i) => i + 1);
          return;
        }
        setExhausted(true);
      }}
    />
  );
}
