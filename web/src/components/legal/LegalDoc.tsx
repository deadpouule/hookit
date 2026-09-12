import Link from "next/link";

import type { LegalPage } from "@/lib/legal";
import { LEGAL_UPDATED, PRIVACY_HREF, TERMS_HREF } from "@/lib/legal";

export function LegalDoc({ page, other }: { page: LegalPage; other: "terms" | "privacy" }) {
  return (
    <article className="legal-doc">
      <p className="legal-doc-kicker">{page.kicker}</p>
      <h1 className="legal-doc-title">{page.title}</h1>
      <p className="legal-doc-updated">Updated {LEGAL_UPDATED}</p>
      <p className="legal-doc-lead">{page.lead}</p>
      {page.sections.map((section) => (
        <section key={section.title} className="legal-doc-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <p className="legal-doc-also">
        Also see the{" "}
        {other === "privacy" ? (
          <Link href={PRIVACY_HREF}>privacy page</Link>
        ) : (
          <Link href={TERMS_HREF}>terms</Link>
        )}
        .
      </p>
    </article>
  );
}
