"use client";

export function CosmicBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-black">
      <div className="star-field absolute inset-0 opacity-70" />
      <div className="blob-drift absolute -top-24 -left-16 h-[28rem] w-[28rem] rounded-full bg-neon-lime/10 blur-3xl" />
      <div
        className="blob-drift absolute -right-10 bottom-0 h-[32rem] w-[32rem] rounded-full bg-base-blue/20 blur-3xl"
        style={{ animationDelay: "-7s" }}
      />
      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}
