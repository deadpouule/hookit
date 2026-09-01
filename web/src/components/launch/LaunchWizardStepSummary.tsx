"use client";

import {
  summarizeNextStep,
  summarizePreviousStep,
} from "@/lib/launch-wizard-summary";
import type { LaunchFormState } from "@/lib/types";

export function LaunchWizardStepSummary({
  step,
  form,
}: {
  step: number;
  form: LaunchFormState;
}) {
  const previous = summarizePreviousStep(step, form);
  const next = summarizeNextStep(step);

  if (!previous && !next) return null;

  return (
    <div className="launch-wizard-context-inline">
      {previous ? (
        <p className="launch-wizard-context-inline-line">
          <span className="launch-wizard-context-inline-label">Previous</span>
          <span className="launch-wizard-context-inline-title">{previous.title}</span>
          <span className="launch-wizard-context-inline-sep">·</span>
          <span className="launch-wizard-context-inline-detail">{previous.detail}</span>
        </p>
      ) : null}
      {next ? (
        <p className="launch-wizard-context-inline-line">
          <span className="launch-wizard-context-inline-label">Next</span>
          <span className="launch-wizard-context-inline-title">{next.title}</span>
          <span className="launch-wizard-context-inline-sep">·</span>
          <span className="launch-wizard-context-inline-detail">{next.detail}</span>
        </p>
      ) : null}
    </div>
  );
}
