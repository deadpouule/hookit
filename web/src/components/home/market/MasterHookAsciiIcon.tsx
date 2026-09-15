import { HookLogo } from "@/components/home/market/HookLogo";
import { FIXED_FEE_HOOK, MASTER_HOOKS, type BrowseHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

export function MasterHookAsciiIcon({
  hookId,
  className,
}: {
  hookId: BrowseHookId;
  className?: string;
}) {
  const hook =
    hookId === "fixed-fee"
      ? FIXED_FEE_HOOK
      : MASTER_HOOKS.find((item) => item.id === hookId);
  if (!hook) return null;

  return (
    <span className={cn("master-hook-ascii-icon", className)}>
      <HookLogo hookId={hookId} theme={hook.theme} />
    </span>
  );
}
