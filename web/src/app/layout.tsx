import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-black" suppressHydrationWarning>
        <AppErrorBoundary>
          <Web3Provider>
            <TooltipProvider>
              {children}
              <AppToaster />
              <Telemetry />
            </TooltipProvider>
          </Web3Provider>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
