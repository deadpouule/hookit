"use client";

import {
  LayoutGrid,
  Search,
  Table2,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";

import { SEARCH_FIELD_PROPS, TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

import { CustomsGlyph } from "./CategoryGlyphs";
import { MasterHookFilterMenu } from "./MasterHookFilterMenu";
import { RwaFilterMenu } from "./RwaFilterMenu";
import type { MasterHookId } from "@/lib/master-hooks";

export type SortKey = "top" | "almostBonded" | "live";
export type CategoryKey = "all" | "master" | "customs" | "rwa";

type MarketplaceToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  category: CategoryKey;
  onCategoryChange: (category: CategoryKey) => void;
  masterHooks: MasterHookId[];
  onMasterHooksChange: (hooks: MasterHookId[]) => void;
  onActivateMaster: () => void;
  rwaQuote: string | null;
  onRwaQuoteChange: (quote: string | null) => void;
  onActivateRwa: () => void;
  layout: "grid" | "table";
  onLayoutChange: (layout: "grid" | "table") => void;
};

export function MarketplaceToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  masterHooks,
  onMasterHooksChange,
  onActivateMaster,
  rwaQuote,
  onRwaQuoteChange,
  onActivateRwa,
  layout,
  onLayoutChange,
}: MarketplaceToolbarProps) {
  return (
    <div className="market-toolbar" suppressHydrationWarning>
      <label className="market-toolbar-search">
        <Search className="pointer-events-none h-4 w-4 shrink-0 text-zinc-500" />
        <input
          {...SEARCH_FIELD_PROPS}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search hookit tokens"
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
        />
      </label>

      <div className="market-toolbar-divider" aria-hidden />

      <div className="market-toolbar-group">
        <FilterPill active={sort === "top"} onClick={() => onSortChange("top")} icon={Trophy} label="Top" />
        <FilterPill
          active={sort === "almostBonded"}
          onClick={() => onSortChange("almostBonded")}
          glyph={<AlmostBondedGlyph />}
          label="Almost bonded"
        />
        <FilterPill active={sort === "live"} onClick={() => onSortChange("live")} live label="Live feed" />
      </div>

      <div className="market-toolbar-divider" aria-hidden />

      <div className="market-toolbar-group market-toolbar-group--category">
        <FilterPill active={category === "all"} onClick={() => onCategoryChange("all")} label="All" />
        <MasterHookFilterMenu
          active={category === "master"}
          selectedHooks={masterHooks}
          onSelectedHooksChange={onMasterHooksChange}
          onActivateMaster={onActivateMaster}
        />
        <FilterPill
          active={category === "customs"}
          onClick={() => onCategoryChange("customs")}
          glyph={<CustomsGlyph />}
          label="Customs"
        />
        <RwaFilterMenu
          active={category === "rwa"}
          selectedQuote={rwaQuote}
          onSelectedQuoteChange={onRwaQuoteChange}
          onActivateRwa={onActivateRwa}
        />
      </div>

      <div className="market-toolbar-view-wrap">
        <div className="market-toolbar-divider" aria-hidden />
        <div className="market-toolbar-view">
          <IconToggle active={layout === "table"} onClick={() => onLayoutChange("table")} label="Table">
            <Table2 className="h-4 w-4" />
          </IconToggle>
          <IconToggle active={layout === "grid"} onClick={() => onLayoutChange("grid")} label="Grid">
            <LayoutGrid className="h-4 w-4" />
          </IconToggle>
        </div>
      </div>
    </div>
  );
}

function AlmostBondedGlyph() {
  return (
    <span className="filter-bond-glyph" aria-hidden>
      <span className="filter-bond-track">
        <span className="filter-bond-fill" />
      </span>
    </span>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon: Icon,
  glyph,
  live,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: typeof Trophy;
  glyph?: ReactNode;
  live?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...TOOLBAR_BUTTON_PROPS}
      className={cn(
        "market-filter-pill",
        active && "market-filter-pill--active",
      )}
    >
      {live ? (
        <span className="market-live-dot" />
      ) : glyph ? (
        glyph
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {label}
    </button>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...TOOLBAR_BUTTON_PROPS}
      className={cn("market-view-toggle", active && "market-view-toggle--active")}
    >
      {children}
    </button>
  );
}
