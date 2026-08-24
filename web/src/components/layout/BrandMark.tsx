export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 35% 25%, rgb(232 121 249 / 0.45), transparent 55%), linear-gradient(145deg, #1a1a22 0%, #050505 55%, #12101a 100%)",
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 -1px 0 rgb(0 0 0 / 0.5), 0 4px 20px rgb(168 85 247 / 0.2)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-[52%] w-[52%]" fill="none" aria-hidden>
        <path
          d="M7 5c0 0 1.5 1.5 5 1.5S17 5 17 5v3.5c0 3.2-2.4 6.5-5 8-2.6-1.5-5-4.8-5-8V5z"
          fill="url(#ink-hook)"
          stroke="rgb(196 181 253 / 0.35)"
          strokeWidth="0.6"
        />
        <path
          d="M12 11v6M9.5 17h5"
          stroke="rgb(232 121 249 / 0.5)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="ink-hook" x1="7" y1="5" x2="17" y2="16">
            <stop stopColor="#fafafa" />
            <stop offset="1" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
