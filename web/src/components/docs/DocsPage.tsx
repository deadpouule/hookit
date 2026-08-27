"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildDocsSections,
  DOCS_NAV,
  type DocsBlock,
  type DocsSectionId,
} from "@/lib/docs-content";
import { getNetworkLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";

function DocsBlockView({ block }: { block: DocsBlock }) {
  switch (block.type) {
    case "p":
      return <p className="docs-p">{block.text}</p>;
    case "h3":
      return <h3 className="docs-h3">{block.text}</h3>;
    case "ul":
      return (
        <ul className="docs-ul">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <aside className="docs-callout">
          {block.title && <p className="docs-callout-title">{block.title}</p>}
          <ul>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      );
    case "steps":
      return (
        <ol className="docs-steps">
          {block.steps.map((step) => (
            <li key={step.num}>
              <span className="docs-step-num">{step.num}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "defs":
      return (
        <dl className="docs-defs">
          {block.rows.map((row) => (
            <div key={row.term} className="docs-def-row">
              <dt>{row.term}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      );
    case "code":
      return (
        <figure className="docs-code">
          {block.title && <figcaption>{block.title}</figcaption>}
          <pre>
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case "contract":
      return (
        <div className="docs-contract">
          <div className="docs-contract-head">
            <span>{block.label}</span>
            {block.note && <span className="docs-contract-note">{block.note}</span>}
          </div>
          <code>{block.address}</code>
        </div>
      );
    case "divider":
      return (
        <div className="docs-divider">
          <span>{block.label}</span>
        </div>
      );
    default:
      return null;
  }
}

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
          <p className="docs-eyebrow">hook it docs</p>
          <h1 className="docs-hero-title">Everything about hook it, in one place.</h1>
          <p className="docs-hero-lede">
            How to launch, trade, and stay safe on {network}. Plain language — no custody, no hidden steps.
          </p>
        </header>

        <div className="docs-layout">
          <aside className="docs-sidebar">
            <nav className="docs-nav" aria-label="Documentation">
              {DOCS_NAV.map((group) => (
                <div key={group.group} className="docs-nav-group">
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
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className={cn(
                  "docs-section",
                  section.id === "integration" && "docs-section-integration",
                )}
              >
                {section.id === "integration" ? (
                  <>
                    <p className="docs-integration-kicker">Reference</p>
                    <h2 className="docs-section-title docs-section-title-lg">{section.title}</h2>
                  </>
                ) : (
                  <h2 className="docs-section-title">{section.title}</h2>
                )}
                <div className="docs-section-body">
                  {section.blocks.map((block, i) => (
                    <DocsBlockView key={`${section.id}-${i}`} block={block} />
                  ))}
                </div>
              </section>
            ))}

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
