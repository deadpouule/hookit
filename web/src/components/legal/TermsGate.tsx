"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { WelcomeOwl } from "@/components/brand/WelcomeOwl";
import { LEGAL_ACK_KEY, PRIVACY_HREF, TERMS_HREF } from "@/lib/legal";

const LEGAL_PATHS = new Set([TERMS_HREF, PRIVACY_HREF]);

export function TermsGate() {
  const pathname = usePathname();
  const [needsAck, setNeedsAck] = useState(false);

  useEffect(() => {
    try {
      setNeedsAck(window.localStorage.getItem(LEGAL_ACK_KEY) !== "1");
    } catch {
      setNeedsAck(true);
    }
  }, []);

  if (!needsAck || LEGAL_PATHS.has(pathname)) return null;

  const continueOn = () => {
    try {
      window.localStorage.setItem(LEGAL_ACK_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setNeedsAck(false);
  };

  return (
    <div className="legal-gate" role="dialog" aria-modal="true" aria-labelledby="legal-gate-title">
      <div className="legal-gate-card">
        <h2 id="legal-gate-title" className="legal-gate-title">
          <span>Welcome to</span>
          <WelcomeOwl />
        </h2>
        <p className="legal-gate-copy">
          By continuing, you agree to our{" "}
          <Link href={TERMS_HREF} target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href={PRIVACY_HREF} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>{" "}
          and confirm you are 18 years of age or older.
        </p>
        <button type="button" className="legal-gate-cta" onClick={continueOn}>
          Agree and Continue
        </button>
      </div>
    </div>
  );
}
