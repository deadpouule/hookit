"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches client crashes so localhost never stays a blank black screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
          <p className="text-lg font-semibold">hook it — client error</p>
          <p className="max-w-lg text-sm text-zinc-400">
            The UI crashed during load. Try a hard refresh, disable browser extensions (Dashlane,
            1Password), or run{" "}
            <code className="text-zinc-200">cd web && rm -rf .next && npm run dev</code>.
          </p>
          <pre className="max-w-xl overflow-x-auto rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-left text-xs text-red-200">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
