export const metadata = {
  title: "Protocol Floor | hook it",
  description: "HOOK token backed floor — ratchet mechanism powered by protocol revenue.",
};

export default function FloorPage() {
  return (
    <div className="form-shell pt-10">
      <h1 className="mb-2 text-center text-2xl font-semibold text-white sm:text-3xl">
        Protocol floor
      </h1>
      <p className="mb-10 text-center text-sm text-zinc-500">
        80% of protocol revenue → HOOK FloorVault. ΔP<sub>floor</sub> ≥ 0.
      </p>

      <div className="panel p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="section-label">Floor price</p>
            <p className="mt-1 font-mono text-2xl text-white">$0.0042</p>
          </div>
          <div>
            <p className="section-label">Vault reserve</p>
            <p className="mt-1 font-mono text-2xl text-white">128.4 ETH</p>
          </div>
          <div>
            <p className="section-label">Circulating</p>
            <p className="mt-1 font-mono text-2xl text-white">1.00B HOOK</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.06] bg-black/40 p-4 text-sm text-zinc-500">
          Permissionless <code className="font-mono text-zinc-400">redeemFloor()</code> burns HOOK
          and withdraws quote at the mathematical floor rate.
        </div>
      </div>
    </div>
  );
}
