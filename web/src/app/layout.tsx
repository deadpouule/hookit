import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-black" suppressHydrationWarning>
        <Web3Provider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
