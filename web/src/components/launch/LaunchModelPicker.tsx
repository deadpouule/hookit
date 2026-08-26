import Link from "next/link";

function ArrowMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FloralArt() {
  return (
    <div className="launch-model-art relative overflow-hidden">
      <svg
        viewBox="0 0 400 210"
        className="absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
      >
        <g opacity="0.9">
          <ellipse cx="86" cy="118" rx="42" ry="58" fill="#ff7a45" />
          <ellipse cx="118" cy="92" rx="38" ry="50" fill="#ff4d8d" />
          <ellipse cx="64" cy="86" rx="28" ry="36" fill="#ffb347" />
          <circle cx="96" cy="100" r="14" fill="#3b0764" />
        </g>
        <g opacity="0.85">
          <ellipse cx="248" cy="78" rx="48" ry="62" fill="#e879f9" />
          <ellipse cx="286" cy="108" rx="40" ry="52" fill="#c026d3" />
          <ellipse cx="220" cy="112" rx="32" ry="40" fill="#fb7185" />
          <circle cx="256" cy="98" r="13" fill="#1e1b4b" />
        </g>
        <g opacity="0.75">
          <ellipse cx="340" cy="150" rx="36" ry="46" fill="#a78bfa" />
          <ellipse cx="168" cy="168" rx="30" ry="38" fill="#f472b6" />
        </g>
      </svg>
    </div>
  );
}

export function LaunchModelPicker() {
  return (
    <div className="launch-stars min-h-[calc(100vh-8rem)] px-4 pt-16 pb-20 sm:pt-24">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-10 text-center text-4xl font-semibold tracking-tight text-white sm:mb-14 sm:text-5xl">
          Choose a launch model.
        </h1>

        <div className="launch-model-grid">
          <Link href="/launch/classic" className="launch-model-card">
            <FloralArt />
            <div className="flex flex-1 flex-col px-6 pt-6 pb-7">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Classic.</h2>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-400">
                Create a Classic coin
                <ArrowMark />
              </p>
            </div>
          </Link>

          <Link href="/launch/custom" className="launch-model-card">
            <FloralArt />
            <div className="relative flex flex-1 flex-col px-6 pt-6 pb-7">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Custom.</h2>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-400">
                Create a Custom coin with a hook
                <ArrowMark />
              </p>
              <span className="absolute right-6 bottom-7 text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
                Hook
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
