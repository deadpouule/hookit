import { cn } from "@/lib/utils";

export function WelcomeOwl({ className }: { className?: string }) {
  return (
    <span className={cn("welcome-owl", className)} role="img" aria-label="hookit">
      {/* Plain img keeps the transparent eye holes; next/image flattens them to white. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/hookit-owl-mark.png"
        alt=""
        className="welcome-owl-mark"
        draggable={false}
      />
      <span className="welcome-owl-lid welcome-owl-lid--l" />
      <span className="welcome-owl-lid welcome-owl-lid--r" />
    </span>
  );
}
