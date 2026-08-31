import { Suspense } from "react";

import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata = {
  title: "Master launch | hook it",
  description: "Launch a token with Hookit Master modules on Uniswap v4.",
};

export default function CustomLaunchRoute() {
  return (
    <Suspense fallback={null}>
      <LaunchForm variant="custom" />
    </Suspense>
  );
}
