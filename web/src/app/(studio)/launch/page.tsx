import { LaunchModelPicker } from "@/components/launch/LaunchModelPicker";

export const metadata = {
  title: "Launch | hook it",
  description: "Choose Classic bonding or Master modular launch on Uniswap v4.",
};

export default function LaunchRoute() {
  return <LaunchModelPicker />;
}
