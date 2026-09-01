"use client";

import { cn } from "@/lib/utils";

type Step = { id: number; label: string };

export function LaunchWizardStepper({
  steps,
  current,
  className,
}: {
  steps: readonly Step[];
  current: number;
  className?: string;
}) {
  const total = steps.length;
  const active = steps.find((step) => step.id === current);

  return (
    <div className={cn("launch-wizard-stepper", className)}>
      <p className="launch-wizard-stepper-count">
        {current}/{total}
      </p>
      <div className="launch-wizard-stepper-track" aria-hidden>
        {steps.map((step) => (
          <span
            key={step.id}
            className={cn(
              "launch-wizard-stepper-dot",
              step.id < current && "launch-wizard-stepper-dot--done",
              step.id === current && "launch-wizard-stepper-dot--active",
            )}
          />
        ))}
      </div>
      {active ? <p className="launch-wizard-stepper-label">{active.label}</p> : null}
    </div>
  );
}
