import type { Metadata } from "next";

import { LegalDoc } from "@/components/legal/LegalDoc";
import { PRIVACY_PAGE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What hook it can see: almost nothing off-chain. The ledger stays public.",
};

export default function PrivacyPage() {
  return <LegalDoc page={PRIVACY_PAGE} other="terms" />;
}
