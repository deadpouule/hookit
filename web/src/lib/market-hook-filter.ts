import { isMasterHookId, type MasterHookId } from "@/lib/master-hooks";
import { INK_QUOTRON_STOCKS } from "@/lib/xstocks";

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

export function parseQuoteParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const match = INK_QUOTRON_STOCKS.find((stock) => stock.symbol.toLowerCase() === normalized.toLowerCase());
  return match?.symbol ?? null;
}

export function marketplaceHrefForRwaQuote(quote: string | null): string {
  const params = new URLSearchParams();
  params.set("category", "rwa");
  if (quote) {
    params.set("quote", quote);
  }
  return `/?${params.toString()}#tokens`;
}

export function exploreUsesHref(hookId: MasterHookId, hookFilters: MasterHookId[] = []): string {
  const params = new URLSearchParams();
  params.set("uses", hookId);
  if (hookFilters.length > 0) {
    params.set("hooks", serializeHooksParam(hookFilters));
  }
  return `/explore?${params.toString()}`;
}
