"use client";

import { useLoginWithEmail, useLoginWithOAuth, useLoginWithPasskey, useLoginWithSms, useSignupWithPasskey } from "@privy-io/react-auth";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowLeft, Fingerprint, Mail, Phone, Search, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useConnect, useConnectors, type Connector } from "wagmi";

import { SEARCH_FIELD_PROPS, TOOLBAR_BUTTON_PROPS } from "@/lib/search-field";
import { isPrivyConfigured, isPrivyWagmiConnector } from "@/lib/privy";
import { PRIVACY_HREF, TERMS_HREF } from "@/lib/legal";

type Step = "welcome" | "otp" | "wallets";

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

const SOCIAL_UNAVAILABLE = "Social login is not configured on this build.";

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
    if (isPrivyWagmiConnector(connector)) continue;
    const key = connectorKey(connector);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(connector);
  }
  return unique.sort((a, b) => featuredRank(a) - featuredRank(b) || a.name.localeCompare(b.name));
}

function connectErrorMessage(cause: unknown): string {
  const message =
    cause && typeof cause === "object" && "shortMessage" in cause
      ? String((cause as { shortMessage?: string }).shortMessage)
      : cause instanceof Error
        ? cause.message
        : "Could not connect";
  if (/rejected|denied|cancel/i.test(message)) return "";
  return message;
}

type OtpChannel = "email" | "sms";

type SocialAuth = {
  configured: boolean;
  busy: boolean;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (code: string) => Promise<void>;
  sendSmsCode: (phone: string) => Promise<void>;
  verifySmsCode: (code: string) => Promise<void>;
  loginPasskey: () => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginTwitter: () => Promise<void>;
};

const unavailableAuth: SocialAuth = {
  configured: false,
  busy: false,
  sendEmailCode: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  verifyEmailCode: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  sendSmsCode: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  verifySmsCode: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  loginPasskey: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  loginGoogle: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
  loginTwitter: async () => {
    throw new Error(SOCIAL_UNAVAILABLE);
  },
};

export function WelcomeConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (isPrivyConfigured()) {
    return <WelcomeConnectModalPrivy open={open} onClose={onClose} />;
  }
  return <WelcomeConnectModalView open={open} onClose={onClose} auth={unavailableAuth} />;
}

function WelcomeConnectModalPrivy({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [oauthBusy, setOauthBusy] = useState(false);
  const { sendCode: sendEmailCode, loginWithCode: loginEmailCode, state: emailState } = useLoginWithEmail();
  const { sendCode: sendSmsCode, loginWithCode: loginSmsCode, state: smsState } = useLoginWithSms();
  const { loginWithPasskey, state: passkeyLoginState } = useLoginWithPasskey();
  const { signupWithPasskey, state: passkeySignupState } = useSignupWithPasskey();
  const { initOAuth } = useLoginWithOAuth();

  const emailBusy =
    emailState.status === "sending-code" || emailState.status === "submitting-code";
  const smsBusy = smsState.status === "sending-code" || smsState.status === "submitting-code";
  const passkeyBusy =
    passkeyLoginState.status === "generating-challenge" ||
    passkeyLoginState.status === "awaiting-passkey" ||
    passkeyLoginState.status === "submitting-response" ||
    passkeySignupState.status === "generating-challenge" ||
    passkeySignupState.status === "awaiting-passkey" ||
    passkeySignupState.status === "submitting-response";

  const auth: SocialAuth = {
    configured: true,
    busy: oauthBusy || emailBusy || smsBusy || passkeyBusy,
    sendEmailCode: async (email) => {
      await sendEmailCode({ email });
    },
    verifyEmailCode: async (code) => {
      await loginEmailCode({ code });
    },
    sendSmsCode: async (phoneNumber) => {
      await sendSmsCode({ phoneNumber });
    },
    verifySmsCode: async (code) => {
      await loginSmsCode({ code });
    },
    loginPasskey: async () => {
      try {
        await loginWithPasskey();
      } catch {
        await signupWithPasskey();
      }
    },
    loginGoogle: async () => {
      setOauthBusy(true);
      try {
        await initOAuth({ provider: "google" });
      } finally {
        setOauthBusy(false);
      }
    },
    loginTwitter: async () => {
      setOauthBusy(true);
      try {
        await initOAuth({ provider: "twitter" });
      } finally {
        setOauthBusy(false);
      }
    },
  };

  return <WelcomeConnectModalView open={open} onClose={onClose} auth={auth} />;
}

function WelcomeConnectModalView({
  open,
  onClose,
  auth,
}: {
  open: boolean;
  onClose: () => void;
  auth: SocialAuth;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("email");
  const [code, setCode] = useState("");
  const [walletQuery, setWalletQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { openConnectModal } = useConnectModal();
  const connectors = useConnectors();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("welcome");
      setEmail("");
      setPhone("");
      setOtpChannel("email");
      setCode("");
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

  const goBack = () => {
    setError(null);
    setCode("");
    setStep("welcome");
  };

  const submitEmail = async () => {
    const next = email.trim();
    if (!next) return;
    setError(null);
    try {
      await auth.sendEmailCode(next);
      setOtpChannel("email");
      setStep("otp");
    } catch (cause) {
      setError(connectErrorMessage(cause) || SOCIAL_UNAVAILABLE);
    }
  };

  const submitPhone = async () => {
    const next = phone.trim();
    if (!next) return;
    setError(null);
    try {
      await auth.sendSmsCode(next);
      setOtpChannel("sms");
      setStep("otp");
    } catch (cause) {
      setError(connectErrorMessage(cause) || SOCIAL_UNAVAILABLE);
    }
  };

  const submitCode = async () => {
    const next = code.trim();
    if (!next) return;
    setError(null);
    try {
      if (otpChannel === "sms") await auth.verifySmsCode(next);
      else await auth.verifyEmailCode(next);
      onClose();
    } catch (cause) {
      setError(connectErrorMessage(cause) || "Invalid code");
    }
  };

  const resendCode = async () => {
    if (otpChannel === "sms") await submitPhone();
    else await submitEmail();
  };

  const loginPasskey = async () => {
    setError(null);
    try {
      await auth.loginPasskey();
    } catch (cause) {
      setError(connectErrorMessage(cause) || SOCIAL_UNAVAILABLE);
    }
  };

  const socialLogin = async (provider: "google" | "twitter") => {
    setError(null);
    try {
      if (provider === "google") await auth.loginGoogle();
      else await auth.loginTwitter();
    } catch (cause) {
      setError(connectErrorMessage(cause) || SOCIAL_UNAVAILABLE);
    }
  };

  const connectWallet = async (connector: Connector) => {
    setError(null);
    setPendingId(connector.uid);
    try {
      await connectAsync({ connector });
      onClose();
    } catch (cause) {
      const message = connectErrorMessage(cause);
      if (message) setError(message);
    } finally {
      setPendingId(null);
    }
  };

  const busy = auth.busy || pendingId !== null;

  return createPortal(
    <div className="welcome-connect" role="dialog" aria-modal="true" aria-labelledby="welcome-connect-title">
      <button type="button" className="welcome-connect__backdrop" aria-label="Close" onClick={onClose} />
      <div className="welcome-connect__card">
        <div className="welcome-connect__chrome">
          {step !== "welcome" ? (
            <button
              type="button"
              className="welcome-connect__icon-btn"
              aria-label="Back"
              onClick={goBack}
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
              <img src="/brand/hookit-owl-mark.png" alt="" width={184} height={129} draggable={false} />
            </span>
            <h2 id="welcome-connect-title" className="welcome-connect__title">
              Welcome to Hookit
            </h2>
            <p className="welcome-connect__subtitle">Launch and trade programmed v4 hooks on Ink.</p>

            <button
              type="button"
              className="welcome-connect__row"
              disabled={busy}
              onClick={() => {
                if (openConnectModal) {
                  onClose();
                  window.setTimeout(() => openConnectModal(), 40);
                  return;
                }
                goToWallets();
              }}
              {...TOOLBAR_BUTTON_PROPS}
            >
              <Wallet className="h-5 w-5" aria-hidden />
              Continue with a wallet
            </button>

            <form
              className="welcome-connect__email"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEmail();
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
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" disabled={busy || !email.trim()}>
                Submit
              </button>
            </form>

            <form
              className="welcome-connect__email"
              onSubmit={(event) => {
                event.preventDefault();
                void submitPhone();
              }}
            >
              <Phone className="welcome-connect__field-icon" aria-hidden />
              <input
                type="tel"
                name="welcome-phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+1 phone number"
                value={phone}
                disabled={busy}
                onChange={(event) => setPhone(event.target.value)}
              />
              <button type="submit" disabled={busy || !phone.trim()}>
                SMS
              </button>
            </form>

            <button
              type="button"
              className="welcome-connect__row"
              disabled={busy}
              onClick={() => void loginPasskey()}
              {...TOOLBAR_BUTTON_PROPS}
            >
              <Fingerprint className="h-5 w-5" aria-hidden />
              Passkey
            </button>
            <button
              type="button"
              className="welcome-connect__row"
              disabled={busy}
              onClick={() => void socialLogin("google")}
              {...TOOLBAR_BUTTON_PROPS}
            >
              <GoogleMark />
              Google
            </button>
            <button
              type="button"
              className="welcome-connect__row"
              disabled={busy}
              onClick={() => void socialLogin("twitter")}
              {...TOOLBAR_BUTTON_PROPS}
            >
              <TwitterMark />
              Twitter
            </button>
            {error ? <p className="welcome-connect__error">{error}</p> : null}
            <p className="welcome-connect__legal">
              By continuing, you agree to our{" "}
              <Link href={TERMS_HREF} target="_blank" rel="noopener noreferrer">
                Terms
              </Link>{" "}
              and{" "}
              <Link href={PRIVACY_HREF} target="_blank" rel="noopener noreferrer">
                Privacy
              </Link>
              .
            </p>
          </div>
        ) : step === "otp" ? (
          <div className="welcome-connect__body">
            <span className="welcome-connect__mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/hookit-owl-mark.png" alt="" width={184} height={129} draggable={false} />
            </span>
            <h2 id="welcome-connect-title" className="welcome-connect__title">
              {otpChannel === "sms" ? "Check your phone" : "Check your email"}
            </h2>
            <p className="welcome-connect__subtitle">
              Enter the code we sent to{" "}
              <span className="welcome-connect__email-value">{otpChannel === "sms" ? phone : email}</span>
            </p>

            <form
              className="welcome-connect__email"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCode();
              }}
            >
              <input
                type="text"
                name="welcome-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="6-digit code"
                value={code}
                disabled={busy}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button type="submit" disabled={busy || code.trim().length < 4}>
                Verify
              </button>
            </form>

            <button
              type="button"
              className="welcome-connect__resend"
              disabled={busy}
              onClick={() => void resendCode()}
              {...TOOLBAR_BUTTON_PROPS}
            >
              Resend code
            </button>
            {error ? <p className="welcome-connect__error">{error}</p> : null}
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

function TwitterMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.59l-5.16-6.74L5.2 22H1.93l8.02-9.16L1.5 2h6.75l4.67 6.18L18.244 2Zm-1.16 18.06h1.81L7 3.84H5.06l12.02 16.22Z"
      />
    </svg>
  );
}
