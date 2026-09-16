"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

import { HookLogo } from "@/components/home/market/HookLogo";
import {
  hookThemeAccentColor,
  launchComboHref,
  type BrowseHook,
} from "@/lib/master-hooks";

export function HookComboBar({
  selected,
  onRemove,
}: {
  selected: BrowseHook[];
  onRemove: (hook: BrowseHook) => void;
}) {
  return (
    <div className="hook-combo-bar">
      <div className="hook-combo-copy">
        <p className="hook-combo-title">Build a combo</p>
        <p className="hook-combo-hint">
          {selected.length === 0
            ? "Add modules with + Combo, then launch them together"
            : `${selected.length} module${selected.length === 1 ? "" : "s"} stacked`}
        </p>
      </div>
      <div className="hook-combo-picks">
        {selected.map((hook) => (
          <button
            key={hook.id}
            type="button"
            className="hook-combo-chip"
            style={{ "--pulse-accent": hookThemeAccentColor(hook.theme) } as CSSProperties}
            onClick={() => onRemove(hook)}
            title={`Remove ${hook.title}`}
          >
            <HookLogo hookId={hook.id} theme={hook.theme} />
            <span>{hook.title}</span>
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <Link
        href={launchComboHref(selected.map((hook) => hook.id))}
        className={selected.length > 0 ? "hook-combo-launch is-on" : "hook-combo-launch"}
      >
        {selected.length > 0 ? "Launch combo" : "Open launch"}
      </Link>
    </div>
  );
}
