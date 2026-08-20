import { cn } from "@/lib/utils";

interface HookBadgeProps {
  icon: string;
  label: string;
  active?: boolean;
  className?: string;
}

export function HookBadge({ icon, label, active = true, className }: HookBadgeProps) {
  if (!active) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 bg-gradient-to-r from-white/10 to-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur-sm",
        className,
      )}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}

interface ModuleTagProps {
  label: string;
  variant?: "default" | "lime" | "blue";
}

export function ModuleTag({ label, variant = "default" }: ModuleTagProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variant === "lime" && "border-neon-lime/30 bg-neon-lime/10 text-neon-lime",
        variant === "blue" && "border-base-blue/30 bg-base-blue/10 text-blue-300",
        variant === "default" && "border-white/10 bg-white/5 text-zinc-300",
      )}
    >
      {label}
    </span>
  );
}
