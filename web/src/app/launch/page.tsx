import { LaunchForm } from "@/components/launch/LaunchForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Create | hook it",
  description: "Launch a token atomically on Uniswap v4 with modular hook architecture.",
};

export default function LaunchRoute() {
  return (
    <>
      <LaunchForm />
      <SiteFooter />
    </>
  );
}
