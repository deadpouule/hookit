import { Suspense } from "react";

import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata = {
  title: "Custom launch | hook it",
  description: "Launch a token with Master or Custom Uniswap v4 hooks.",
};

export default function CustomLaunchRoute() {
  return (
    <Suspense fallback={null}>
      <LaunchForm variant="custom" />
    </Suspense>
  );
}
