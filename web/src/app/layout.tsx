import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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

export const metadata: Metadata = {
  title: "hook it — Uniswap v4 Launchpad on Ink",
  description:
    "Permissionless modular launchpad on Ink. Dual-rail Master + Classic bonding, Quotrons wStocks, locked LP, quote-only fees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-black" suppressHydrationWarning>
        <Web3Provider>
          <TooltipProvider>
            {children}
            <AppToaster />
            <Telemetry />
          </TooltipProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
