import { HookLogo } from "@/components/home/market/HookLogo";
import { MASTER_HOOKS, type MasterHookId } from "@/lib/master-hooks";
import { cn } from "@/lib/utils";

export function MasterHookAsciiIcon({
  hookId,
  className,
}: {
  hookId: MasterHookId;
  className?: string;
}) {
  const hook = MASTER_HOOKS.find((item) => item.id === hookId);
  if (!hook) return null;

  return (
    <span className={cn("master-hook-ascii-icon", className)}>
      <HookLogo hookId={hookId} theme={hook.theme} />
    </span>
  );
}
