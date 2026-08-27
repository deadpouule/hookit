import { Suspense } from "react";

import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata = {
  title: "Classic launch | hook it",
  description: "Launch a Classic token on Uniswap v4 — no extra hook modules.",
};

export default function ClassicLaunchRoute() {
  return (
    <Suspense fallback={null}>
      <LaunchForm variant="classic" />
    </Suspense>
  );
}
