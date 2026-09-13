import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PickCard({
  selected,
  title,
  subtitle,
  onClick,
  children,
  variant = "default",
  disabled = false,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "pair";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        "pick-card",
        variant === "pair" && "pick-card--pair",
        selected && "is-on",
        disabled && "is-off",
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div className="pick-card-mark">{children}</div>
      <p className={cn("pick-card-title", variant === "pair" && "pick-card-title--pair")}>{title}</p>
      <p className="pick-card-sub">{subtitle}</p>
    </button>
  );
}
