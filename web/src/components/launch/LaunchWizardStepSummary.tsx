"use client";

import { summarizeCompletedSteps } from "@/lib/launch-wizard-summary";
import type { LaunchFormState } from "@/lib/types";

export function LaunchWizardStepSummary({
  step,
  form,
}: {
  step: number;
  form: LaunchFormState;
}) {
  const completed = summarizeCompletedSteps(step, form);

  if (completed.length === 0) return null;

  return (
    <aside className="launch-wizard-recap">
      <p className="launch-wizard-recap-label">Your progress</p>
      <div className="launch-wizard-recap-list">
        {completed.map((block) => (
          <section key={block.title} className="launch-wizard-recap-card">
            <p className="launch-wizard-recap-title">{block.title}</p>
            <p className="launch-wizard-recap-detail">{block.detail}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}
