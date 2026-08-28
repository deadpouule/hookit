"use client";

import { CategorySplitFilter } from "@/components/home/market/CategorySplitFilter";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { MasterHookAsciiIcon } from "@/components/home/market/MasterHookAsciiIcon";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";

type MasterHookFilterMenuProps = {
  active: boolean;
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
  onActivateMaster: () => void;
};

const DROPDOWN_CONTENT_PROPS = {
  side: "bottom" as const,
  align: "start" as const,
  sideOffset: 6,
  avoidCollisions: false,
};

export function MasterHookFilterMenu({
  active,
  selectedHooks,
  onSelectedHooksChange,
  onActivateMaster,
}: MasterHookFilterMenuProps) {
  const label =
    selectedHooks.length === 0
      ? "Master"
      : selectedHooks.length === 1
        ? (MASTER_HOOKS.find((hook) => hook.id === selectedHooks[0])?.title ?? "Master")
        : `Master (${selectedHooks.length})`;

  const items = MASTER_HOOKS.map((hook) => ({
    id: hook.id,
    title: hook.title,
    subtitle: hook.keyword,
    icon: <MasterHookAsciiIcon hookId={hook.id} />,
  }));

  return (
    <CategorySplitFilter
      active={active}
      label={label}
      allLabel="All master hooks"
      searchPlaceholder="Search master hooks"
      glyph={<MasterHookGlyph />}
      items={items}
      selectedIds={selectedHooks}
      onActivate={onActivateMaster}
      onSelectedIdsChange={(ids) => onSelectedHooksChange(ids as MasterHookId[])}
    />
  );
}

export function MasterHookBadgeMenu({
  selectedHooks = [],
  onSelectedHooksChange,
  onNavigate,
  className,
}: {
  poolHookIds?: MasterHookId[];
  selectedHooks?: MasterHookId[];
  onSelectedHooksChange?: (hookIds: MasterHookId[]) => void;
  onNavigate?: (hookIds: MasterHookId[]) => void;
  className?: string;
}) {
  const applySelection = (hookIds: MasterHookId[]) => {
    if (onSelectedHooksChange) {
      onSelectedHooksChange(hookIds);
      return;
    }
    onNavigate?.(hookIds);
  };

  return (
    <DropdownMenu modal={false}>
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
        {...DROPDOWN_CONTENT_PROPS}
        className="master-hook-filter-menu w-56 border-white/10 bg-[#141416] p-1 text-zinc-200"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Filter by hook
        </DropdownMenuLabel>
        <MasterHookCheckboxOptions
          hookOptions={MASTER_HOOKS.map((hook) => hook.id)}
          selectedHooks={selectedHooks}
          onSelectedHooksChange={applySelection}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MasterHookTokenBadgeFilter({
  selectedHooks,
  onSelectedHooksChange,
  className,
}: {
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
  className?: string;
}) {
  return (
    <MasterHookBadgeMenu
      selectedHooks={selectedHooks}
      onSelectedHooksChange={onSelectedHooksChange}
      className={className}
    />
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
        onCheckedChange={() => onSelectedHooksChange([])}
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
