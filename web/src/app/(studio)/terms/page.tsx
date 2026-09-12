import type { Metadata } from "next";

import { LegalDoc } from "@/components/legal/LegalDoc";
import { TERMS_PAGE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "What hook it is: a self-custodial Uniswap v4 launchpad. Not a broker, not advice.",
};

export default function TermsPage() {
  return <LegalDoc page={TERMS_PAGE} other="privacy" />;
}
