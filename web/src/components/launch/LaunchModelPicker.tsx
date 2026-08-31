import Link from "next/link";

import { AnimatedGridBackground } from "@/components/home/market/AnimatedGridBackground";

import { LaunchHookReel } from "./LaunchHookReel";

function ClassicAsciiCoin() {
  return (
    <pre className="launch-classic-ascii" aria-hidden>
      {`        .  .  .  .
     .              .
   .                  .
  .                    .
 .                      .
  .                    .
   .                  .
     .              .
        .  .  .  .`}
    </pre>
  );
}

export function LaunchModelPicker() {
  return (
    <div className="launch-stars min-h-[calc(100vh-8rem)] px-4 pt-16 pb-20 sm:pt-24">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="terminal-title mb-10 text-center font-mono text-4xl font-semibold tracking-tight text-white sm:mb-14 sm:text-5xl">
          Choose a launch model.
        </h1>

        <div className="launch-model-grid">
          <Link href="/launch/classic" className="launch-model-card" aria-label="Classic. Create a Classic coin">
            <div className="launch-model-stage" aria-hidden>
              <AnimatedGridBackground className="launch-model-grid-bg" />
              <ClassicAsciiCoin />
            </div>
            <div className="launch-model-copy">
              <h2 className="terminal-title font-mono text-3xl font-semibold tracking-tight text-white">Classic.</h2>
              <p>
                Create a Classic coin
                <span aria-hidden>-&gt;</span>
              </p>
            </div>
          </Link>

          <Link href="/launch/custom" className="launch-model-card" aria-label="Master. Launch with Hookit Master modules">
            <div className="launch-model-stage" aria-hidden>
              <AnimatedGridBackground className="launch-model-grid-bg" />
              <LaunchHookReel />
            </div>
            <div className="launch-model-copy">
              <h2 className="terminal-title font-mono text-3xl font-semibold tracking-tight text-white">Master.</h2>
              <p>
                Master modules — anti-snipe, floor, burn
                <span aria-hidden>-&gt;</span>
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
