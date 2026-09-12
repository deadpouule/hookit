import type { Metadata } from "next";

import { LegalDoc } from "@/components/legal/LegalDoc";
import { PRIVACY_SECTIONS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Hookit handles wallet addresses, onchain data, and site logs.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      kicker="Privacy"
      title="Privacy notice"
      updated="12 Sep 2026"
      sections={PRIVACY_SECTIONS}
      other="terms"
    />
  );
}
