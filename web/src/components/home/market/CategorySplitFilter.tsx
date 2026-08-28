"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { cn } from "@/lib/utils";

export type CategorySplitFilterItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  imageUrl?: string;
};

type CategorySplitFilterProps = {
  active: boolean;
  label: string;
  allLabel: string;
  searchPlaceholder: string;
  glyph: ReactNode;
  items: CategorySplitFilterItem[];
  selectedIds: string[];
  onActivate: () => void;
  onSelectedIdsChange: (ids: string[]) => void;
};

export function CategorySplitFilter({
  active,
  label,
  allLabel,
  searchPlaceholder,
  glyph,
  items,
  selectedIds,
  onActivate,
  onSelectedIdsChange,
}: CategorySplitFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  const allSelected = selectedIds.length === 0;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.subtitle?.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery)
    );
  });

  const handleLabelClick = () => {
    if (!active) {
      onActivate();
      return;
    }
  };

  const handleChevronClick = () => {
    if (!active) {
      onActivate();
      setOpen(true);
      return;
    }
    setOpen((prev) => !prev);
  };

  const selectAll = () => {
    onSelectedIdsChange([]);
    setOpen(false);
  };

  const toggleItem = (id: string) => {
    if (allSelected) {
      onSelectedIdsChange([id]);
      setOpen(false);
      return;
    }

    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((itemId) => itemId !== id));
      return;
    }

    onSelectedIdsChange([...selectedIds, id]);
  };

  return (
    <div
      ref={rootRef}
      className={cn("category-split-filter", active && "category-split-filter--active", open && "category-split-filter--open")}
    >
      <div className={cn("category-split-pill", active && "category-split-pill--active")}>
        <button
          type="button"
          {...TOOLBAR_BUTTON_PROPS}
          className="category-split-pill__label"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={handleLabelClick}
        >
          {glyph}
          <span>{label}</span>
        </button>
        <button
          type="button"
          {...TOOLBAR_BUTTON_PROPS}
          className="category-split-pill__chevron"
          aria-label={`Filter ${label}`}
          aria-expanded={open}
          onClick={handleChevronClick}
        >
          <ChevronDown className={cn("category-split-pill__chevron-icon", open && "category-split-pill__chevron-icon--open")} />
        </button>
      </div>

      {open && active && (
        <div className="category-split-menu" role="listbox" aria-label={allLabel}>
          <label className="category-split-menu__search" htmlFor={searchId}>
            <Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
              autoFocus
            />
          </label>

          <button
            type="button"
            role="option"
            aria-selected={allSelected}
            className={cn("category-split-menu__item", allSelected && "category-split-menu__item--selected")}
            onClick={selectAll}
          >
            <span className="category-split-menu__item-text">
              <span className="category-split-menu__item-title">{allLabel}</span>
            </span>
          </button>

          <div className="category-split-menu__list">
            {filteredItems.length === 0 ? (
              <p className="category-split-menu__empty">No matches</p>
            ) : (
              filteredItems.map((item) => {
                const selected = !allSelected && selectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn("category-split-menu__item", selected && "category-split-menu__item--selected")}
                    onClick={() => toggleItem(item.id)}
                  >
                    <CategorySplitFilterItemVisual item={item} />
                    <span className="category-split-menu__item-text">
                      <span className="category-split-menu__item-title">{item.title}</span>
                      {item.subtitle ? (
                        <span className="category-split-menu__item-subtitle">{item.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySplitFilterItemVisual({ item }: { item: CategorySplitFilterItem }) {
  if (item.imageUrl) {
    return (
      <span className="category-split-menu__avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
      </span>
    );
  }

  if (item.icon) {
    return <span className="category-split-menu__avatar category-split-menu__avatar--icon">{item.icon}</span>;
  }

  return null;
}
