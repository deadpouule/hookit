import { isMasterHookId, type MasterHookId } from "@/lib/master-hooks";

export function parseHooksParam(value: string | null | undefined): MasterHookId[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(isMasterHookId);
}

export function serializeHooksParam(hookIds: MasterHookId[]): string {
  return hookIds.join(",");
}

export function marketplaceHrefForHooks(hookIds: MasterHookId[]): string {
  const params = new URLSearchParams();
  params.set("category", "master");
  if (hookIds.length > 0) {
    params.set("hooks", serializeHooksParam(hookIds));
  }
  return `/?${params.toString()}#tokens`;
}

export function marketplaceHrefForHook(hookId: MasterHookId): string {
  return marketplaceHrefForHooks([hookId]);
}
