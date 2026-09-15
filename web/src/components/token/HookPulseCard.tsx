"use client";

import { useMemo, type CSSProperties } from "react";

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
  const { hooks, detail } = useMemo(() => {
    const resolved = resolveTokenModules(pool);
    if (!resolved) return { hooks: [] as MasterHook[], detail: null as string | null };
    const next = MASTER_HOOKS.filter((hook) => isModuleEnabled(resolved.modules, hook.id));
    const featured = next[0];
    return {
      hooks: next,
      detail: featured
        ? moduleDetailLine(featured.id, resolved.modules, resolved.hookTaxBps)
        : null,
    };
  }, [pool]);

  const featured = hooks[0];
  if (!featured) return <div className="token-hook-pulse" aria-hidden />;

  const accent = hookThemeAccentColor(featured.theme);

  return (
    <div
      className="token-hook-pulse"
      style={{ "--pulse-accent": accent } as CSSProperties}
    >
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
    </div>
  );
}
