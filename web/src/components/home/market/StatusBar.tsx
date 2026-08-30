"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { GITHUB_REPO_URL, TWITTER_URL } from "@/lib/constants";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.53 2.865 8.37 6.839 9.722.5.094.683-.222.683-.492 0-.243-.01-1.048-.014-1.9-2.782.618-3.37-1.37-3.37-1.37-.454-1.178-1.11-1.491-1.11-1.491-.908-.636.069-.623.069-.623 1.004.072 1.533 1.057 1.533 1.057.892 1.566 2.341 1.114 2.91.852.091-.662.35-1.114.636-1.37-2.22-.259-4.555-1.14-4.555-5.073 0-1.12.39-2.036 1.03-2.754-.103-.26-.447-1.3.098-2.71 0 0 .84-.276 2.75 1.051A9.35 9.35 0 0 1 12 7.138c.85.004 1.705.117 2.504.343 1.909-1.327 2.747-1.051 2.747-1.051.547 1.41.203 2.45.1 2.71.64.718 1.028 1.633 1.028 2.754 0 3.942-2.339 4.811-4.566 5.064.359.317.679.943.679 1.902 0 1.372-.012 2.477-.012 2.814 0 .273.18.592.688.491C19.138 20.62 22 16.78 22 12.253 22 6.586 17.523 2 12 2Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export function StatusBar() {
  return (
    <div className="status-bar">
      <div className="market-shell status-bar-inner">
        <div className="status-bar-links">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="status-bar-icon"
            aria-label="GitHub"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="status-bar-icon"
            aria-label="X"
          >
            <XIcon className="h-3.5 w-3.5" />
          </a>
          <Link href="/docs" className="status-bar-icon" aria-label="Docs">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </div>
  );
}
