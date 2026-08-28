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

export function parseUsesParam(value: string | null | undefined): MasterHookId | null {
  if (!value || !isMasterHookId(value)) return null;
  return value;
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

export function exploreUsesHref(hookId: MasterHookId, hookFilters: MasterHookId[] = []): string {
  const params = new URLSearchParams();
  params.set("uses", hookId);
  if (hookFilters.length > 0) {
    params.set("hooks", serializeHooksParam(hookFilters));
  }
  return `/explore?${params.toString()}`;
}
