"use client";

import { HookKeychain } from "./HookKeychain";

export function LeanHero() {
  return (
    <section className="lean-hero relative overflow-visible rounded-3xl bg-[#280120]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="liquid-blob liquid-blob-a" />
        <div className="liquid-blob liquid-blob-b" />
        <div className="liquid-blob liquid-blob-c" />
        <div className="liquid-blob liquid-blob-d" />
      </div>

      <div className="relative z-10 flex h-full flex-row items-start justify-start gap-8 py-8 pl-12 pr-6 lg:pl-20">
        <HookKeychain />
        <h1 className="mt-3 max-w-xl shrink-0 text-left text-5xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl lg:mt-4 lg:text-7xl">
          Launch with
          <br />
          programmable hooks
        </h1>
      </div>
    </section>
  );
}
