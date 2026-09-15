"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { HookLogo } from "@/components/home/market/HookLogo";
import { formatAge } from "@/lib/format";
import {
  isModuleEnabled,
  moduleDetailLine,
  resolveTokenModules,
} from "@/lib/launch-module-summary";
import {
  hookThemeAccentColor,
  MASTER_HOOKS,
  type MasterHook,
} from "@/lib/master-hooks";
import type { TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHOW_AT_PX = 108;

function sentence(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function HookPulseCard({
  pool,
  holders,
  txns,
  ageSeconds,
}: {
  pool: TokenPool;
  holders: number;
  txns: number;
  ageSeconds: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  const { hooks, detail } = useMemo(() => {
    const resolved = resolveTokenModules(pool);
    if (!resolved) return { hooks: [] as MasterHook[], detail: null as string | null };
    const hooks = MASTER_HOOKS.filter((hook) => isModuleEnabled(resolved.modules, hook.id));
    const featured = hooks[0];
    return {
      hooks,
      detail: featured
        ? moduleDetailLine(featured.id, resolved.modules, resolved.hookTaxBps)
        : null,
    };
  }, [pool]);

  const featured = hooks[0];
  const accent = featured ? hookThemeAccentColor(featured.theme) : "#9514d1";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOn(el.clientHeight >= SHOW_AT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!featured) return <div ref={ref} className="token-hook-pulse" aria-hidden />;

  return (
    <div
      ref={ref}
      className={cn("token-hook-pulse", on && "is-on")}
      style={{ "--pulse-accent": accent } as CSSProperties}
      aria-hidden={!on}
    >
      {on ? (
        <div className="token-hook-pulse-card desk-card">
          <span className="token-hook-pulse-mark" aria-hidden>
            <HookLogo hookId={featured.id} theme={featured.theme} />
          </span>
          {hooks.length > 1 ? (
            <div className="token-hook-pulse-stack">
              {hooks.slice(0, 4).map((hook) => (
                <HookLogo key={hook.id} hookId={hook.id} theme={hook.theme} />
              ))}
            </div>
          ) : null}
          <p className="token-hook-pulse-kicker">
            {hooks.length === 1 ? "Master module" : `${hooks.length} master modules`}
          </p>
          <h3 className="token-hook-pulse-title">
            {hooks.length <= 2 ? hooks.map((h) => h.title).join(" + ") : featured.title}
          </h3>
          <p className="token-hook-pulse-desc">
            {sentence(featured.description)}
            {detail ? ` · ${detail}` : ""}
          </p>
          <dl className="token-hook-pulse-facts">
            <div>
              <dt>Holders</dt>
              <dd>{holders > 0 ? holders.toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{ageSeconds != null ? formatAge(ageSeconds) : "—"}</dd>
            </div>
            <div>
              <dt>Txns</dt>
              <dd>{txns > 0 ? txns.toLocaleString() : "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
