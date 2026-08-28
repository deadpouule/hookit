"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [open, setOpen] = useState(false);

  const label =
    selectedHooks.length === 0
      ? "Master"
      : selectedHooks.length === 1
        ? MASTER_HOOKS.find((hook) => hook.id === selectedHooks[0])?.title ?? "Master"
        : `Master (${selectedHooks.length})`;

  const applySelection = (hooks: MasterHookId[]) => {
    onOpenMasterCategory();
    onSelectedHooksChange(hooks);
  };

  return (
    <MasterHookFilterSheet
      open={open}
      onOpenChange={setOpen}
      selectedHooks={selectedHooks}
      onSelectedHooksChange={applySelection}
      title="Master hooks"
      description="Filter tokens by master hook modules"
      trigger={
        <button
          type="button"
          {...TOOLBAR_BUTTON_PROPS}
          className={cn("market-filter-pill", active && "market-filter-pill--active")}
        >
          <MasterHookGlyph />
          {label}
        </button>
      }
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
  const [open, setOpen] = useState(false);

  const applySelection = (hookIds: MasterHookId[]) => {
    if (onSelectedHooksChange) {
      onSelectedHooksChange(hookIds);
      return;
    }
    onNavigate?.(hookIds);
    setOpen(false);
  };

  return (
    <MasterHookFilterSheet
      open={open}
      onOpenChange={setOpen}
      selectedHooks={selectedHooks}
      onSelectedHooksChange={applySelection}
      title="Filter by hook"
      description="Pick one or more master hooks"
      trigger={
        <button
          type="button"
          className={className}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master
        </button>
      }
    />
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

function MasterHookFilterSheet({
  open,
  onOpenChange,
  selectedHooks,
  onSelectedHooksChange,
  title,
  description,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
  title: string;
  description: string;
  trigger: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="master-hook-filter-sheet max-h-[75vh] overflow-hidden rounded-t-2xl border-white/10 bg-[#141416] p-0 text-zinc-200"
      >
        <SheetHeader className="border-b border-white/[0.06] px-5 py-4 text-left">
          <SheetTitle className="text-base font-semibold text-white">{title}</SheetTitle>
          <SheetDescription className="text-zinc-400">{description}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-3 py-3">
          <MasterHookCheckboxList
            hookOptions={MASTER_HOOKS.map((hook) => hook.id)}
            selectedHooks={selectedHooks}
            onSelectedHooksChange={onSelectedHooksChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MasterHookCheckboxList({
  hookOptions,
  selectedHooks,
  onSelectedHooksChange,
}: {
  hookOptions: MasterHookId[];
  selectedHooks: MasterHookId[];
  onSelectedHooksChange: (hooks: MasterHookId[]) => void;
}) {
  const allSelected = selectedHooks.length === 0;

  const toggleHook = (hookId: MasterHookId) => {
    if (allSelected) {
      onSelectedHooksChange([hookId]);
      return;
    }
    if (selectedHooks.includes(hookId)) {
      const next = selectedHooks.filter((id) => id !== hookId);
      onSelectedHooksChange(next);
      return;
    }
    onSelectedHooksChange([...selectedHooks, hookId]);
  };

  return (
    <div className="master-hook-filter-sheet-list space-y-0.5">
      <MasterHookFilterOption
        label="All"
        checked={allSelected}
        onSelect={() => onSelectedHooksChange([])}
      />
      <div className="my-2 h-px bg-white/10" aria-hidden />
      {hookOptions.map((hookId) => {
        const hook = MASTER_HOOKS.find((item) => item.id === hookId);
        if (!hook) return null;
        return (
          <MasterHookFilterOption
            key={hookId}
            label={hook.title}
            checked={!allSelected && selectedHooks.includes(hookId)}
            onSelect={() => toggleHook(hookId)}
          />
        );
      })}
    </div>
  );
}

function MasterHookFilterOption({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="master-hook-filter-item flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm"
      onClick={onSelect}
    >
      <span>{label}</span>
      {checked ? <Check className="h-4 w-4 text-[#9514d1]" aria-hidden /> : null}
    </button>
  );
}
