import { Code2, Layers } from "lucide-react";

import { HookLogo } from "@/components/home/market/HookLogo";
import { EXPLORE_HOOKS, type BrowseHook, type BrowseHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

const TOTEM_IDS: BrowseHookId[] = [
  "anti-snipe",
  "backed-floor",
  "holder-airdrop",
  "buyback-vesting",
  "auto-burn",
  "deepen-lps",
  "dynamic-fees",
  "anti-mev",
];

const TOTEM_HOOKS: BrowseHook[] = TOTEM_IDS.map((id) => {
  const hook = EXPLORE_HOOKS.find((item) => item.id === id);
  if (!hook) throw new Error(`missing master totem hook ${id}`);
  return hook;
});

function totemPoint(index: number, count: number, radius = 42) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

export function MasterHookGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("category-owl-totem", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/hookit-owl-mark.png"
        alt=""
        width={20}
        height={14}
        className="category-owl-totem__owl"
        draggable={false}
      />
      {TOTEM_HOOKS.map((hook, index) => {
        const point = totemPoint(index, TOTEM_HOOKS.length);
        return (
          <span
            key={hook.id}
            className="category-owl-totem__mark"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <HookLogo hookId={hook.id} theme={hook.theme} />
          </span>
        );
      })}
    </span>
  );
}

export function SinglePairGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("category-single-pair-glyph", className)} aria-hidden>
      <span>╭─●─╮</span>
      <span>╰───╯</span>
    </span>
  );
}

export function CustomsGlyph({ className }: { className?: string }) {
  return <Code2 className={cn("category-customs-icon", className)} aria-hidden />;
}

export function RwaGlyph({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/quotrons-mark.png"
      alt=""
      width={18}
      height={18}
      className={cn("category-quotrons-logo", className)}
      draggable={false}
    />
  );
}

export function MultiPairGlyph({ className }: { className?: string }) {
  return <Layers className={cn("category-multi-pair-icon", className)} aria-hidden />;
}
