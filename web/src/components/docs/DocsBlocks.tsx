"use client";

import Link from "next/link";

import { DocsDiagram, DocsHookCatalog, DocsHookHeading } from "@/components/docs/DocsDiagrams";
import { DocsVisual } from "@/components/docs/DocsVisuals";
import type { DocsBlock } from "@/lib/docs-content";

export function DocsBlockView({ block }: { block: DocsBlock }) {
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
          {block.links && block.links.length > 0 ? (
            <p className="docs-callout-links">
              {block.links.map((link) =>
                link.href.startsWith("http") ? (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ),
              )}
            </p>
          ) : null}
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
    case "diagram":
      return <DocsDiagram id={block.id} />;
    case "visual":
      return <DocsVisual id={block.id} />;
    case "hooks":
      return <DocsHookCatalog />;
    case "hook-title":
      return <DocsHookHeading hookId={block.hookId} />;
    case "formulas":
      return (
        <figure className="docs-formulas">
          {block.title && <figcaption>{block.title}</figcaption>}
          <ul>
            {block.items.map((item) => (
              <li key={item.name}>
                <code className="docs-formula-name">{item.name}</code>
                <code className="docs-formula-math">{item.math}</code>
                {item.note && <p>{item.note}</p>}
              </li>
            ))}
          </ul>
        </figure>
      );
    case "table":
      return (
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                {block.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}
