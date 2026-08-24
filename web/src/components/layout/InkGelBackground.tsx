"use client";

export function InkGelBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div className="ink-bokeh ink-bokeh-1" />
      <div className="ink-bokeh ink-bokeh-2" />
      <div className="noise-overlay absolute inset-0" />
      <div className="ink-vignette absolute inset-0" />
    </div>
  );
}
