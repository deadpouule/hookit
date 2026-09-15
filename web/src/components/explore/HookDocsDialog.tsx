"use client";

import Link from "next/link";
import { useMemo } from "react";

import { DocsBlockView } from "@/components/docs/DocsBlocks";
import { DocsHookHeading } from "@/components/docs/DocsDiagrams";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { docsSectionForHook } from "@/lib/docs-content";
import { launchWithHookHref, type BrowseHook } from "@/lib/master-hooks";

export function HookDocsDialog({
  hook,
  onOpenChange,
}: {
  hook: BrowseHook | null;
  onOpenChange: (open: boolean) => void;
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
            <div className="hook-docs-dialog-actions">
              <Link href={launchWithHookHref(hook.id)} className="hook-docs-launch">
                Use this hook
              </Link>
              {section ? (
                <Link href={`/docs#${section.id}`} className="hook-docs-more">
                  Full docs
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
