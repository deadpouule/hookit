import Link from "next/link";

import type { LegalSection } from "@/lib/legal";
import { PRIVACY_HREF, TERMS_HREF } from "@/lib/legal";

export function LegalDoc({
  kicker,
  title,
  updated,
  sections,
  other,
}: {
  kicker: string;
  title: string;
  updated: string;
  sections: LegalSection[];
  other: "terms" | "privacy";
}) {
  return (
    <article className="legal-doc">
      <p className="legal-doc-kicker">{kicker}</p>
      <h1 className="legal-doc-title">{title}</h1>
      <p className="legal-doc-updated">Updated {updated}</p>
      {sections.map((section) => (
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
          <Link href={PRIVACY_HREF}>Privacy notice</Link>
        ) : (
          <Link href={TERMS_HREF}>Terms</Link>
        )}
        .
      </p>
    </article>
  );
}
