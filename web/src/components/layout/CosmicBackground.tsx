"use client";

export function CosmicBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-black">
      <div className="star-field absolute inset-0 opacity-70" />
      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}
