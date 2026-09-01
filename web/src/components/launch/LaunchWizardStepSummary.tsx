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
    <aside className="launch-wizard-context">
      {previous ? (
        <section className="launch-wizard-context-block">
          <p className="launch-wizard-context-label">Previous step</p>
          <div className="launch-wizard-context-card">
            <p className="launch-wizard-context-title">{previous.title}</p>
            <p className="launch-wizard-context-detail">{previous.detail}</p>
          </div>
        </section>
      ) : null}

      {next ? (
        <section className="launch-wizard-context-block">
          <p className="launch-wizard-context-label">Up next</p>
          <div className="launch-wizard-context-card launch-wizard-context-card--next">
            <p className="launch-wizard-context-title">{next.title}</p>
            <p className="launch-wizard-context-detail">{next.detail}</p>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
