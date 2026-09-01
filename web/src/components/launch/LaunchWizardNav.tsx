"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";

export function LaunchWizardNav({
  step,
  onBack,
  onContinue,
  continueLabel = "Continue",
  showContinue = true,
}: {
  step: number;
  onBack: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  showContinue?: boolean;
}) {
  return (
    <div className="launch-wizard-nav">
      {step > 1 ? (
        <button type="button" onClick={onBack} className="launch-wizard-nav-btn">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : (
        <span aria-hidden />
      )}
      {showContinue && onContinue ? (
        <button type="button" onClick={onContinue} className="launch-wizard-nav-btn">
          {continueLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}
