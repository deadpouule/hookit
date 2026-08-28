"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { resolveTokenContractAddress, type MarketToken } from "@/lib/market-tokens";
import { cn } from "@/lib/utils";

export function CopyContractButton({
  token,
  className,
}: {
  token: MarketToken;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const address = resolveTokenContractAddress(token);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!(await copyToClipboard(address))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn("token-copy-ca", className)}
      aria-label="Copy contract address"
      title={copied ? "Copied" : "Copy contract address"}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}
