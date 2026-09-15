"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { HookLogo } from "@/components/home/market/HookLogo";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts/config";
import { shortenAddress } from "@/lib/format";
import {
  enabledMasterHooksInOrder,
  moduleDetailLine,
  resolveTokenModules,
} from "@/lib/launch-module-summary";
import {
  hookThemeAccentColor,
  type MasterHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROTATE_MS = 4500;

function sentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HookPulseCard({ pool }: { pool: TokenPool }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const { hooks, details } = useMemo(() => {
    const resolved = resolveTokenModules(pool);
    if (!resolved) return { hooks: [] as MasterHook[], details: [] as string[] };
    const next = enabledMasterHooksInOrder(resolved.modules);
    return {
      hooks: next,
      details: next.map((hook) => moduleDetailLine(hook.id, resolved.modules, resolved.hookTaxBps)),
    };
  }, [pool]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused || hooks.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % hooks.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [hooks.length, paused, reduceMotion, clock]);

  const hookKey = hooks.map((hook) => hook.id).join("|");
  useEffect(() => {
    setIndex(0);
  }, [pool.id, pool.contractAddress, hookKey]);

  const featured = hooks[hooks.length ? index % hooks.length : 0];
  if (!featured) return <div className="token-hook-pulse" aria-hidden />;

  const accent = hookThemeAccentColor(featured.theme);
  const detail = details[index % hooks.length];
  const hookAddr = pool.hooksAddress;
  const explorerHref = hookAddr ? `${BLOCK_EXPLORER_URL}/address/${hookAddr}` : undefined;

  const pick = (i: number) => {
    setIndex(i);
    setClock((n) => n + 1);
  };

  return (
    <div
      className={cn("token-hook-pulse", hooks.length > 1 && "has-dots")}
      style={{ "--pulse-accent": accent } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <a
        className="token-hook-pulse-card desk-card"
        href={explorerHref}
        target="_blank"
        rel="noreferrer"
      >
        <span className="token-hook-pulse-slide" key={featured.id}>
          <span className="token-hook-pulse-mark" aria-hidden>
            <HookLogo hookId={featured.id} theme={featured.theme} />
          </span>
          <h3 className="token-hook-pulse-title">{featured.title}</h3>
          <p className="token-hook-pulse-desc">
            {sentence(featured.description)}
            {detail ? ` · ${detail}` : ""}
          </p>
          {explorerHref ? (
            <span className="token-hook-pulse-link">
              Hook
              <span className="token-hook-pulse-addr">{hookAddr ? shortenAddress(hookAddr) : ""}</span>
              <ExternalLink />
            </span>
          ) : null}
        </span>
      </a>
      {hooks.length > 1 ? (
        <div className="token-hook-pulse-dots" role="tablist" aria-label="Master modules">
          {hooks.map((hook, i) => (
            <button
              key={hook.id}
              type="button"
              role="tab"
              aria-selected={i === index % hooks.length}
              aria-label={hook.title}
              className={cn("token-hook-pulse-dot", i === index % hooks.length && "is-on")}
              onClick={() => pick(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
