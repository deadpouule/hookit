"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LEGAL_ACK_KEY, PRIVACY_HREF, TERMS_HREF } from "@/lib/legal";
import { cn } from "@/lib/utils";

const LEGAL_PATHS = new Set([TERMS_HREF, PRIVACY_HREF]);

export function TermsGate() {
  const pathname = usePathname();
  const [needsAck, setNeedsAck] = useState(false);
  const [accepted, setAccepted] = useState(false);

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
        <p className="legal-gate-kicker">Before you trade</p>
        <h2 id="legal-gate-title" className="legal-gate-title">
          A few things to know
        </h2>
        <div className="legal-gate-copy">
          <p>
            You trade from your own wallet, and it stays yours. Hookit never holds your funds. That
            also means a transaction cannot be undone once your wallet signs it.
          </p>
          <p>
            Anyone can launch a token here. We do not approve, vet or endorse any of them, and the
            index also lists tokens Hookit did not launch. Prices move, a token can lose all of its
            value, and nothing here is financial advice.
          </p>
        </div>
        <label className="legal-gate-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I have read and accept the{" "}
            <Link href={TERMS_HREF} target="_blank" rel="noopener noreferrer">
              Terms
            </Link>{" "}
            and the{" "}
            <Link href={PRIVACY_HREF} target="_blank" rel="noopener noreferrer">
              Privacy notice
            </Link>
            .
          </span>
        </label>
        <button
          type="button"
          className={cn("legal-gate-cta", !accepted && "is-off")}
          disabled={!accepted}
          onClick={continueOn}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
