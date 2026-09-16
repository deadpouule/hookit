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
    const ids = sections.map((section) => section.id);
    const pick = () => {
      const probe = Math.min(176, window.innerHeight * 0.24);
      let current: DocsSectionId = ids[0] ?? "overview";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - probe <= 0) current = id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
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
