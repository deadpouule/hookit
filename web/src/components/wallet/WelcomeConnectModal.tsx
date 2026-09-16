"use client";

import { ArrowLeft, Mail, Search, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useConnectors, type Connector } from "wagmi";

import { SEARCH_FIELD_PROPS, TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";

type Step = "welcome" | "wallets";

const FEATURED_ORDER = [
  "metamask",
  "io.metamask",
  "coinbase",
  "coinbasewallet",
  "com.coinbase.wallet",
  "rainbow",
  "me.rainbow",
  "robinhood",
  "base",
  "baseaccount",
  "walletconnect",
  "injected",
];

function connectorIcon(connector: Connector): string | undefined {
  if (typeof connector.icon === "string" && connector.icon.length > 0) {
    return connector.icon;
  }
  const details = (
    connector as { rkDetails?: { iconUrl?: string | (() => string | Promise<string>) } }
  ).rkDetails;
  const iconUrl = details?.iconUrl;
  return typeof iconUrl === "string" && iconUrl.length > 0 ? iconUrl : undefined;
}

function connectorKey(connector: Connector): string {
  return `${connector.id} ${connector.name}`.toLowerCase().replace(/[\s._-]+/g, "");
}

function featuredRank(connector: Connector): number {
  const key = connectorKey(connector);
  const index = FEATURED_ORDER.findIndex((id) => key.includes(id));
  return index === -1 ? FEATURED_ORDER.length : index;
}

function uniqueConnectors(connectors: readonly Connector[]): Connector[] {
  const seen = new Set<string>();
  const unique: Connector[] = [];
  for (const connector of connectors) {
    const key = connectorKey(connector);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(connector);
  }
  return unique.sort((a, b) => featuredRank(a) - featuredRank(b) || a.name.localeCompare(b.name));
}

export function WelcomeConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [walletQuery, setWalletQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("welcome");
      setEmail("");
      setWalletQuery("");
      setPendingId(null);
      setError(null);
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && isConnected) onClose();
  }, [open, isConnected, onClose]);

  const wallets = useMemo(() => uniqueConnectors(connectors), [connectors]);
  const filteredWallets = useMemo(() => {
    const q = walletQuery.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter((wallet) => wallet.name.toLowerCase().includes(q));
  }, [wallets, walletQuery]);

  if (!mounted || !open) return null;

  const goToWallets = () => {
    setError(null);
    setStep("wallets");
  };

  const connectWallet = async (connector: Connector) => {
    setError(null);
    setPendingId(connector.uid);
    try {
      await connectAsync({ connector });
      onClose();
    } catch (cause) {
      const message =
        cause && typeof cause === "object" && "shortMessage" in cause
          ? String((cause as { shortMessage?: string }).shortMessage)
          : cause instanceof Error
            ? cause.message
            : "Could not connect";
      if (!/rejected|denied|cancel/i.test(message)) {
        setError(message);
      }
    } finally {
      setPendingId(null);
    }
  };

  return createPortal(
    <div className="welcome-connect" role="dialog" aria-modal="true" aria-labelledby="welcome-connect-title">
      <button type="button" className="welcome-connect__backdrop" aria-label="Close" onClick={onClose} />
      <div className="welcome-connect__card">
        <div className="welcome-connect__chrome">
          {step === "wallets" ? (
            <button
              type="button"
              className="welcome-connect__icon-btn"
              aria-label="Back"
              onClick={() => {
                setError(null);
                setStep("welcome");
              }}
              {...TOOLBAR_BUTTON_PROPS}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="welcome-connect__icon-btn welcome-connect__icon-btn--ghost" />
          )}
          <button
            type="button"
            className="welcome-connect__icon-btn"
            aria-label="Close"
            onClick={onClose}
            {...TOOLBAR_BUTTON_PROPS}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "welcome" ? (
          <div className="welcome-connect__body">
            <span className="welcome-connect__mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/hookit-owl-favicon.png" alt="" width={72} height={72} draggable={false} />
            </span>
            <h2 id="welcome-connect-title" className="welcome-connect__title">
              Welcome to Hookit
            </h2>
            <p className="welcome-connect__subtitle">Launch and trade programmed v4 hooks on Ink.</p>

            <form
              className="welcome-connect__email"
              onSubmit={(event) => {
                event.preventDefault();
                if (!email.trim()) return;
                goToWallets();
              }}
            >
              <Mail className="welcome-connect__field-icon" aria-hidden />
              <input
                type="email"
                name="welcome-email"
                autoComplete="email"
                inputMode="email"
                placeholder="your@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" disabled={!email.trim()}>
                Submit
              </button>
            </form>

            <button type="button" className="welcome-connect__row" onClick={goToWallets} {...TOOLBAR_BUTTON_PROPS}>
              <GoogleMark />
              Google
            </button>
            <button type="button" className="welcome-connect__row" onClick={goToWallets} {...TOOLBAR_BUTTON_PROPS}>
              <Wallet className="h-5 w-5" aria-hidden />
              Continue with a wallet
            </button>
          </div>
        ) : (
          <div className="welcome-connect__body welcome-connect__body--wallets">
            <span className="welcome-connect__wallet-hero" aria-hidden>
              <Wallet className="h-6 w-6" />
            </span>
            <h2 id="welcome-connect-title" className="welcome-connect__title">
              Select your wallet
            </h2>

            <label className="welcome-connect__search">
              <Search className="pointer-events-none h-4 w-4 shrink-0 text-zinc-500" />
              <input
                {...SEARCH_FIELD_PROPS}
                value={walletQuery}
                onChange={(event) => setWalletQuery(event.target.value)}
                placeholder={`Search through ${wallets.length} wallet${wallets.length === 1 ? "" : "s"}`}
              />
            </label>

            <div className="welcome-connect__list">
              {filteredWallets.length === 0 ? (
                <p className="welcome-connect__empty">No wallets match that search.</p>
              ) : (
                filteredWallets.map((connector) => {
                  const icon = connectorIcon(connector);
                  return (
                    <button
                      key={connector.uid}
                      type="button"
                      className="welcome-connect__wallet"
                      disabled={pendingId !== null}
                      onClick={() => void connectWallet(connector)}
                      {...TOOLBAR_BUTTON_PROPS}
                    >
                      <span className="welcome-connect__wallet-icon">
                        {icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" width={28} height={28} />
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                      </span>
                      <span>{connector.name}</span>
                      {pendingId === connector.uid ? <span className="welcome-connect__pending">Connecting</span> : null}
                    </button>
                  );
                })
              )}
            </div>
            {error ? <p className="welcome-connect__error">{error}</p> : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.64-.23-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.79Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.07 7.96-2.94l-3.88-3c-1.08.73-2.47 1.16-4.08 1.16-3.14 0-5.8-2.12-6.76-4.96H1.24v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.24 14.26A7.2 7.2 0 0 1 4.86 12c0-.79.14-1.55.38-2.26V6.65H1.24A12 12 0 0 0 0 12c0 1.94.46 3.77 1.24 5.35l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.96 1.14 15.23 0 12 0 7.31 0 3.26 2.69 1.24 6.65l4 3.09C6.2 6.87 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}
