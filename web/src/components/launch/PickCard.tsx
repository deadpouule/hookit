import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PickCard({
  selected,
  title,
  subtitle,
  onClick,
  children,
  variant = "default",
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "pair";
}) {
  return (
    <button
      type="button"
      className={cn("pick-card", variant === "pair" && "pick-card--pair", selected && "is-on")}
      onClick={onClick}
    >
      <div className="pick-card-mark">{children}</div>
      <p className="pick-card-title">{title}</p>
      <p className="pick-card-sub">{subtitle}</p>
    </button>
  );
}
