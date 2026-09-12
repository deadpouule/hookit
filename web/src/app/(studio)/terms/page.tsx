import type { Metadata } from "next";

import { LegalDoc } from "@/components/legal/LegalDoc";
import { TERMS_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "Hookit terms of use. Self-custodial trading and permissionless launches.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      kicker="Terms"
      title="Terms of use"
      updated="12 Sep 2026"
      sections={TERMS_SECTIONS}
      other="privacy"
    />
  );
}
