import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Bricolage_Grotesque, Audiowide, IBM_Plex_Mono } from "next/font/google";

import { TermsGate } from "@/components/legal/TermsGate";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { AppErrorBoundary } from "@/components/providers/AppErrorBoundary";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { AppToaster } from "@/components/providers/AppToaster";
import { Telemetry } from "@/components/providers/Telemetry";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isPhoneRequest } from "@/lib/device";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, socialMetadata } from "@/lib/site-metadata";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const arcade = Audiowide({
  variable: "--font-arcade",
  subsets: ["latin"],
  weight: "400",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s | Hookit",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/brand/hookit-mark.png",
    apple: "/brand/hookit-mark.png",
  },
  ...socialMetadata(SITE_NAME, SITE_DESCRIPTION),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isPhone = isPhoneRequest(await headers());

  return (
    <html
      lang="en"
      data-device={isPhone ? "phone" : "desktop"}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${arcade.variable} ${ibmPlexMono.variable} dark min-h-dvh antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground touch-manipulation"
        suppressHydrationWarning
      >
        <AppErrorBoundary>
          <Web3Provider>
            <TooltipProvider>
              {children}
              <TermsGate />
              <MobileBottomNav />
              <AppToaster />
              <Telemetry />
            </TooltipProvider>
          </Web3Provider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
