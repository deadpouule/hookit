import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("section-label", className)}>{children}</p>;
}

export function FormPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("panel p-5 sm:p-6", className)}>{children}</div>;
}

export function FormDivider() {
  return <div className="my-6 border-t border-white/[0.06]" />;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-black/50 p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition",
            value === opt.value
              ? "bg-white text-black shadow-sm"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FeeBreakdown({ creator, protocol }: { creator: string; protocol: string }) {
  return (
    <p className="mt-1.5 text-xs text-zinc-500">
      Creator {creator} · Protocol {protocol}
    </p>
  );
}

export function ModuleRow({
  label,
  description,
  enabled,
  onToggle,
  mark,
  children,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  mark?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.05] py-5 last:border-0 last:pb-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {mark}
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-zinc-100">{label}</p>
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition",
            enabled ? "bg-[#9514d1] shadow-[0_0_12px_rgba(149,20,209,0.45)]" : "bg-zinc-700",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform",
              enabled && "translate-x-5",
            )}
          />
        </button>
      </div>
      {enabled && children && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  );
}
