import Link from "next/link";
import { TrendingUp } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Protocol Floor | hook it",
  description: "HOOK token backed floor — ratchet mechanism powered by protocol revenue.",
};

export default function FloorPage() {
  return (
    <>
      <div className="page-shell py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
            Protocol
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            HOOK floor vault
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            80% of protocol revenue flows into the FloorVault. The floor only ratchets up — never
            down.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="panel overflow-hidden">
            <div className="border-b border-white/[0.06] bg-gradient-to-r from-base-blue/10 to-transparent px-6 py-4">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Ratchet floor mechanism
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-3 sm:gap-8">
              <Metric label="Floor price" value="$0.0042" />
              <Metric label="Vault reserve" value="128.4 ETH" />
              <Metric label="Circulating" value="1.00B HOOK" />
            </div>

            <div className="border-t border-white/[0.06] bg-black/30 px-6 py-5">
              <p className="text-sm leading-relaxed text-zinc-500">
                Anyone can call{" "}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                  redeemFloor()
                </code>{" "}
                to burn HOOK and withdraw quote at the mathematical floor rate. Token launches on
                Hookit can optionally route swap fees into per-pool backed floors.
              </p>
              <Link
                href="/launch"
                className="mt-4 inline-flex text-sm text-zinc-300 underline-offset-4 hover:underline"
              >
                Launch with backed floor →
              </Link>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl text-white">{value}</p>
    </div>
  );
}
