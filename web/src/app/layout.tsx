import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { InkGelBackground } from "@/components/layout/InkGelBackground";
import { InkSvgFilters } from "@/components/layout/InkSvgFilters";
import { Navbar } from "@/components/layout/Navbar";
import { Web3Provider } from "@/components/providers/Web3Provider";
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
  title: "hook it — Uniswap v4 Launchpad on Base",
  description:
    "Permissionless modular launchpad. Atomic token deploy, locked LP, quote-only fees, backed floor ratchet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Web3Provider>
          <TooltipProvider>
            <InkGelBackground />
            <InkSvgFilters />
            <Navbar />
            <main className="flex-1">{children}</main>
          </TooltipProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
