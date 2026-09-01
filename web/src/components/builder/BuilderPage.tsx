"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight } from "lucide-react";

import { HookBuilder } from "@/components/builder/HookBuilder";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { EMPTY_BUILDER_DRAFT, buyOverheadBps, saveBuilderDraft, type BuilderDraft } from "@/lib/hook-builder";
import { feeRouteIsComplete } from "@/lib/hook-fee-route";

export function BuilderPage() {
  const [draft, setDraft] = useState<BuilderDraft>(EMPTY_BUILDER_DRAFT);

  const onChange = useCallback((next: BuilderDraft) => {
    setDraft(next);
    saveBuilderDraft(next);
  }, []);

  const persistDraft = () => {
    saveBuilderDraft(draft);
  };
  const routeInvalid = !feeRouteIsComplete(draft.modules);
  const openOverflow = buyOverheadBps(draft.modules, draft.hookTaxBps).atOpen > 10_000;
  const launchBlocked = routeInvalid || openOverflow;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
        <p className="text-xs text-zinc-600">Hookit-native · MasterLaunchHook</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="ink-headline text-3xl sm:text-4xl">
              Build a <span className="text-degen">hook</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
              Compose live modules as blocks. One hook per pool — this is a swap path, not a
              mix. Fees stay quote-only. Then launch the token on Hookit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/launch?from=builder"
              onClick={persistDraft}
              aria-disabled={launchBlocked}
              className={`btn-primary gap-2 ${launchBlocked ? "pointer-events-none opacity-40" : ""}`}
            >
              Launch token
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/launch" className="btn-ghost">
              Skip to create
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <HookBuilder
            modules={draft.modules}
            hookTaxBps={draft.hookTaxBps}
            onChange={onChange}
          />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
