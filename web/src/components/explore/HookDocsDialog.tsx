"use client";

import Link from "next/link";
import { useMemo, type CSSProperties } from "react";

import { DocsBlockView } from "@/components/docs/DocsBlocks";
import { DocsHookHeading } from "@/components/docs/DocsDiagrams";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { docsSectionForHook } from "@/lib/docs-content";
import {
  hookThemeAccentColor,
  launchWithHookHref,
  type BrowseHook,
  type MasterHook,
} from "@/lib/master-hooks";

export function HookDocsDialog({
  hook,
  onOpenChange,
  showUseHook = true,
}: {
  hook: BrowseHook | MasterHook | null;
  onOpenChange: (open: boolean) => void;
  /** Launch CTA lives on the Hooks page only, not token postcards. */
  showUseHook?: boolean;
}) {
  const section = useMemo(
    () => (hook ? docsSectionForHook(hook.id) : undefined),
    [hook],
  );
  const blocks = (section?.blocks ?? []).filter((block) => block.type !== "hook-title");

  return (
    <Dialog open={Boolean(hook)} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-md"
        className="hook-docs-dialog flex sm:max-w-2xl"
        style={
          hook
            ? ({ "--pulse-accent": hookThemeAccentColor(hook.theme) } as CSSProperties)
            : undefined
        }
      >
        {hook ? (
          <>
            <DialogTitle className="sr-only">{hook.title}</DialogTitle>
            <DocsHookHeading hookId={hook.id} as="h2" />
            <DialogDescription className="sr-only">
              {hook.description}
            </DialogDescription>
            <div className="hook-docs-dialog-body docs-section-body">
              {blocks.map((block, i) => (
                <DocsBlockView key={`${hook.id}-${i}`} block={block} />
              ))}
            </div>
            {showUseHook || section ? (
              <div className="hook-docs-dialog-actions">
                {showUseHook ? (
                  <Link
                    href={launchWithHookHref(hook.id)}
                    className={
                      hook.theme === "yellow" || hook.theme === "lime" || hook.theme === "pearl"
                        ? "hook-docs-launch hook-docs-launch--ink"
                        : "hook-docs-launch"
                    }
                  >
                    Use this hook
                  </Link>
                ) : null}
                {section ? (
                  <Link href={`/docs#${section.id}`} className="hook-docs-more">
                    Full docs
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
