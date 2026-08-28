"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

type MasterHookFilterMenuProps = {
  active: boolean;
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
  onOpenMasterCategory: () => void;
};

export function MasterHookFilterMenu({
  active,
  selectedHooks,
  onSelectedHooksChange,
  onOpenMasterCategory,
}: MasterHookFilterMenuProps) {
  const allSelected = selectedHooks.length === 0;

  const toggleHook = (hookId: MasterHookId, checked: boolean) => {
    onOpenMasterCategory();
    if (checked) {
      onSelectedHooksChange([...selectedHooks, hookId]);
      return;
    }
    onSelectedHooksChange(selectedHooks.filter((id) => id !== hookId));
  };

  const label =
    selectedHooks.length === 0
      ? "Master"
      : selectedHooks.length === 1
        ? MASTER_HOOKS.find((hook) => hook.id === selectedHooks[0])?.title ?? "Master"
        : `Master (${selectedHooks.length})`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          {...TOOLBAR_BUTTON_PROPS}
          className={cn("market-filter-pill", active && "market-filter-pill--active")}
        >
          <MasterHookGlyph />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="master-hook-filter-menu w-64 border-white/10 bg-[#141416] p-1 text-zinc-200"
      >
        <DropdownMenuLabel className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Master hooks
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (!checked) return;
            onOpenMasterCategory();
            onSelectedHooksChange([]);
          }}
          className="master-hook-filter-item"
        >
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="bg-white/10" />
        {MASTER_HOOKS.map((hook) => (
          <DropdownMenuCheckboxItem
            key={hook.id}
            checked={!allSelected && selectedHooks.includes(hook.id)}
            onCheckedChange={(checked) => toggleHook(hook.id, checked === true)}
            className="master-hook-filter-item"
          >
            {hook.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MasterHookBadgeMenu({
  poolHookIds,
  onNavigate,
  className,
}: {
  poolHookIds: MasterHookId[];
  onNavigate: (hookIds: MasterHookId[]) => void;
  className?: string;
}) {
  if (poolHookIds.length === 0) {
    return (
      <span className={className}>
        <MasterHookGlyph className="token-type-badge-glyph" />
        Master
      </span>
    );
  }

  if (poolHookIds.length === 1) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onNavigate(poolHookIds);
        }}
      >
        <MasterHookGlyph className="token-type-badge-glyph" />
        Master
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={className}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="master-hook-filter-menu w-56 border-white/10 bg-[#141416] p-1 text-zinc-200"
      >
        <DropdownMenuLabel className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Filter by hook
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="master-hook-filter-item cursor-pointer"
          onSelect={() => onNavigate(poolHookIds)}
        >
          All
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        {poolHookIds.map((hookId) => {
          const hook = MASTER_HOOKS.find((item) => item.id === hookId);
          if (!hook) return null;
          return (
            <DropdownMenuItem
              key={hookId}
              className="master-hook-filter-item cursor-pointer"
              onSelect={() => onNavigate([hookId])}
            >
              {hook.title}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
