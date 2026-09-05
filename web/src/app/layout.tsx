import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { AppErrorBoundary } from "@/components/providers/AppErrorBoundary";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { AppToaster } from "@/components/providers/AppToaster";
import { Telemetry } from "@/components/providers/Telemetry";
import { TooltipProvider } from "@/components/ui/tooltip";

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

export const metadata: Metadata = {
  title: {
    default: "Hookit",
    template: "%s | Hookit",
  },
  description:
    "Permissionless modular launchpad on Ink. Dual-rail Master + Classic bonding, Quotrons wStocks, locked LP, quote-only fees.",
  icons: {
    icon: "/brand/hookit-mark.png",
    apple: "/brand/hookit-mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} dark min-h-dvh antialiased`}
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
