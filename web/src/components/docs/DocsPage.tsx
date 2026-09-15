"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { HookitLogo } from "@/components/brand/HookitLogo";
import { DocsBlockView } from "@/components/docs/DocsBlocks";
import { DocsHookHeading } from "@/components/docs/DocsDiagrams";
import {
  buildDocsSections,
  DOCS_NAV,
  type DocsSectionId,
} from "@/lib/docs-content";
import { getNetworkLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";

export function DocsPage() {
  const sections = useMemo(() => buildDocsSections(), []);
  const [active, setActive] = useState<DocsSectionId>("overview");
  const network = getNetworkLabel();

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id as DocsSectionId);
        }
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: [0, 0.2, 0.4] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: DocsSectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <div className="docs-page">
      <div className="market-shell docs-shell">
        <header className="docs-hero">
          <p className="docs-eyebrow">
            <HookitLogo size="sm" />
            hookit docs
          </p>
          <h1 className="docs-hero-title">
            Everything about <span className="docs-hero-brand">hookit.fun</span>, in one place.
          </h1>
          <p className="docs-hero-lede">
            Dual-rail Uniswap v4 launchpad on {network}. Quote-only fees, locked LP, modular hooks.
            No custody. No hidden steps.
          </p>
        </header>

        <nav className="docs-toc-mobile" aria-label="Documentation sections">
          {DOCS_NAV.flatMap((group) => group.items).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={cn(active === item.id && "is-active")}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="docs-layout">
          <aside className="docs-sidebar">
            <nav className="docs-nav" aria-label="Documentation">
              {DOCS_NAV.map((group) => (
                <div key={`${group.group}-${group.items[0]?.id ?? "empty"}`} className="docs-nav-group">
                  <p className="docs-nav-label">{group.group}</p>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(item.id)}
                          className={cn(active === item.id && "is-active")}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <main className="docs-main">
            {sections.map((section, index) => {
              const prev = sections[index-1];
              const showGroup = !prev || prev.group !== section.group;
              return (
              <section
                key={section.id}
                id={section.id}
                className={cn(
                  "docs-section",
                  section.id === "integration" && "docs-section-integration",
                )}
              >
                {showGroup ? <p className="docs-section-group">{section.group}</p> : null}
                {section.hookId ? (
                  <DocsHookHeading hookId={section.hookId} as="h2" />
                ) : (
                  <h2 className={cn("docs-section-title", section.id === "integration" && "docs-section-title-lg")}>
                    {section.title}
                  </h2>
                )}
                <div className="docs-section-body">
                  {section.blocks.map((block, i) => (
                    <DocsBlockView key={`${section.id}-${i}`} block={block} />
                  ))}
                </div>
              </section>
              );
            })}

            <footer className="docs-footer">
              <p>
                Deployed contracts are immutable. New versions ship as new factory addresses.
              </p>
              <Link href="/">← Back to marketplace</Link>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
