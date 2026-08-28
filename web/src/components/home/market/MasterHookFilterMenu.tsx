"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
        <MasterHookCheckboxOptions
          hookOptions={MASTER_HOOKS.map((hook) => hook.id)}
          selectedHooks={selectedHooks}
          onSelectedHooksChange={(hooks) => {
            onOpenMasterCategory();
            onSelectedHooksChange(hooks);
          }}
        />
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
  const hookOptions =
    poolHookIds.length > 0 ? poolHookIds : (MASTER_HOOKS.map((hook) => hook.id) as MasterHookId[]);

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
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Filter by hook
        </DropdownMenuLabel>
        <MasterHookCheckboxOptions
          hookOptions={hookOptions}
          selectedHooks={[]}
          onSelectedHooksChange={onNavigate}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MasterHookCheckboxOptions({
  hookOptions,
  selectedHooks,
  onSelectedHooksChange,
}: {
  hookOptions: MasterHookId[];
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
}) {
  const allSelected = selectedHooks.length === 0;

  const toggleHook = (hookId: MasterHookId, checked: boolean) => {
    if (checked) {
      onSelectedHooksChange([...selectedHooks, hookId]);
      return;
    }
    onSelectedHooksChange(selectedHooks.filter((id) => id !== hookId));
  };

  return (
    <>
      <DropdownMenuCheckboxItem
        checked={allSelected}
        onCheckedChange={(checked) => {
          if (!checked) return;
          onSelectedHooksChange([]);
        }}
        onSelect={(event) => event.preventDefault()}
        className="master-hook-filter-item"
      >
        All
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator className="bg-white/10" />
      {hookOptions.map((hookId) => {
        const hook = MASTER_HOOKS.find((item) => item.id === hookId);
        if (!hook) return null;
        return (
          <DropdownMenuCheckboxItem
            key={hookId}
            checked={!allSelected && selectedHooks.includes(hookId)}
            onCheckedChange={(checked) => toggleHook(hookId, checked === true)}
            onSelect={(event) => event.preventDefault()}
            className="master-hook-filter-item"
          >
            {hook.title}
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );
}
