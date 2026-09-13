/** Resolve Ink RPC URL for keeper scripts (matches indexer/src/config.ts priority). */
export function resolveInkRpcUrl(): string {
  const list = process.env.INDEXER_RPC_URLS?.trim() || process.env.INK_RPC_URLS?.trim();
  if (list) {
    const first = list.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    process.env.INK_RPC_URL?.trim() ||
    process.env.INK_RPC_URL_BACKUP?.trim() ||
    process.env.INK_RPC_URL_TERTIARY?.trim() ||
    process.env.INDEXER_RPC_URL?.trim() ||
    "https://rpc-gel.inkonchain.com"
  );
}
