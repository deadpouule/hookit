"use client";

import { ArrowDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const PRO_TABS = ["Market", "Limit", "Stop", "TWAP", "DCA"] as const;
type ProTab = (typeof PRO_TABS)[number];

function EthMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#627eea] text-[11px] font-bold text-white">
      Ξ
    </span>
  );
}

function TokenMark({ ticker }: { ticker: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9514d1] text-[10px] font-bold text-white">
      {ticker.slice(0, 2)}
    </span>
  );
}

export function TokenProSwap({ ticker }: { ticker: string }) {
  const [tab, setTab] = useState<ProTab>("Market");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [ethOnTop, setEthOnTop] = useState(true);

  const sellTicker = ethOnTop ? "ETH" : ticker;
  const buyTicker = ethOnTop ? ticker : "ETH";

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-2">
        {PRO_TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative pb-1.5 text-[12px] font-medium transition",
              tab === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {id}
            {tab === id && <span className="absolute inset-x-0 bottom-0 h-px bg-[#9514d1]" />}
          </button>
        ))}
      </div>

      {tab !== "Market" && (
        <p className="text-[11px] text-zinc-500">
          {tab} orders wire to the swap router next — UI is ready.
        </p>
      )}

      <AssetBlock
        label="Sell Token"
        ticker={sellTicker}
        amount={sellAmount}
        onAmount={setSellAmount}
      />

      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Invert pair"
          onClick={() => {
            setEthOnTop((v) => !v);
            setSellAmount(buyAmount);
            setBuyAmount(sellAmount);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1c] text-zinc-300 transition hover:border-[#9514d1] hover:bg-[#9514d1] hover:text-white hover:shadow-[0_0_15px_rgba(149,20,209,0.5)]"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <AssetBlock
        label="Buy Token"
        ticker={buyTicker}
        amount={buyAmount}
        onAmount={setBuyAmount}
      />

      {/* Smart contracts (later): quote via Uniswap v4 Quoter, execute via SwapRouter + Permit2. */}
      <dl className="space-y-1.5 pt-1 text-[12px]">
        <Detail label="Minimum received" value="—" />
        <Detail label="Price impact" value="—" />
        <Detail label="Route" value={`${sellTicker} → ${buyTicker}`} />
        <Detail label="Max slippage" value="5%" />
        <Detail label="Platform fee" value="Free" />
      </dl>
    </div>
  );
}

function AssetBlock({
  label,
  ticker,
  amount,
  onAmount,
}: {
  label: string;
  ticker: string;
  amount: string;
  onAmount: (value: string) => void;
}) {
  return (
    <div className="rounded-lg bg-[#111111] p-3">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        <span>Balance 0.0</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {ticker === "ETH" ? <EthMark /> : <TokenMark ticker={ticker} />}
        <span className="text-sm font-medium text-white">{ticker}</span>
        <input
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder="0.0"
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent text-right font-mono text-2xl text-white outline-none placeholder:text-zinc-600"
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] text-zinc-500">≈ $0.00</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-300">{value}</dd>
    </div>
  );
}
