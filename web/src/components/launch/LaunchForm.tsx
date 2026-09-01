"use client";

import { ClassicLaunchForm } from "@/components/launch/ClassicLaunchForm";
import { MasterLaunchWizard } from "@/components/launch/MasterLaunchWizard";

export function LaunchForm({ variant = "custom" }: { variant?: "classic" | "custom" }) {
  if (variant === "classic") {
    return <ClassicLaunchForm />;
  }

  return <MasterLaunchWizard />;
}
