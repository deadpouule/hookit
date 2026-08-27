import { LaunchModelPicker } from "@/components/launch/LaunchModelPicker";

export const metadata = {
  title: "Launch | hook it",
  description: "Choose a Classic launchpad coin or a Custom hooked token on Uniswap v4.",
};

export default function LaunchRoute() {
  return <LaunchModelPicker />;
}
