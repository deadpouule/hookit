import { type Hex, slice, toBytes, keccak256 } from "viem";

/** Custom error signature → 4-byte selector. */
function errorSelector(signature: string): Hex {
  return slice(keccak256(toBytes(signature)), 0, 4);
}

type KnownError = {
  signature: string;
  userMessage: string;
  logMessage: string;
};

const KNOWN_ERRORS: KnownError[] = [
  // Uniswap v4 core
  { signature: "HookAddressNotValid(address)", userMessage: "Invalid hook address for this pool.", logMessage: "HookAddressNotValid" },
  { signature: "ManagerLocked()", userMessage: "Pool manager is locked — swap reentrancy guard.", logMessage: "ManagerLocked" },
  { signature: "PoolNotInitialized()", userMessage: "Pool is not initialized.", logMessage: "PoolNotInitialized" },
  { signature: "CurrencyNotSettled()", userMessage: "Swap did not settle currencies — hook accounting error.", logMessage: "CurrencyNotSettled" },
  { signature: "SwapAmountCannotBeZero()", userMessage: "Swap amount cannot be zero.", logMessage: "SwapAmountCannotBeZero" },
  { signature: "PriceLimitAlreadyExceeded(uint160,uint160)", userMessage: "Price limit exceeded — pool is at the tick boundary.", logMessage: "PriceLimitAlreadyExceeded" },

  // Hookit — BalancedAggregator
  { signature: "InsufficientOutput()", userMessage: "Slippage exceeded or liquidity too shallow for this size.", logMessage: "InsufficientOutput" },
  { signature: "Expired()", userMessage: "Transaction deadline passed — retry with a fresh quote.", logMessage: "Expired" },
  { signature: "DeadlineTooFar()", userMessage: "Deadline is too far in the future.", logMessage: "DeadlineTooFar" },
  { signature: "UnknownMarket()", userMessage: "Market index is not registered for this launch.", logMessage: "UnknownMarket" },
  { signature: "InvalidLegCount()", userMessage: "Route has too many or too few legs.", logMessage: "InvalidLegCount" },
  { signature: "AmountMismatch()", userMessage: "Leg amounts do not sum to the total input.", logMessage: "AmountMismatch" },
  { signature: "UnsupportedQuote()", userMessage: "This quote asset is not supported by the aggregator.", logMessage: "UnsupportedQuote" },
  { signature: "UnauthorizedBridgeHook()", userMessage: "Bridge hook is not authorized for this route.", logMessage: "UnauthorizedBridgeHook" },

  // Hookit — HookitSwapRouter
  { signature: "InsufficientValue()", userMessage: "Not enough ETH sent for this swap.", logMessage: "InsufficientValue" },
  { signature: "NativeNotAccepted()", userMessage: "This pool does not accept native ETH.", logMessage: "NativeNotAccepted" },
  { signature: "QuoteMismatch()", userMessage: "Quote token does not match the pool.", logMessage: "QuoteMismatch" },

  // Hookit — MasterLaunchHook / modules
  { signature: "MaxTxExceeded()", userMessage: "Trade size exceeds the max-tx limit.", logMessage: "MaxTxExceeded" },
  { signature: "SandwichBlocked()", userMessage: "Anti-sandwich protection blocked this trade.", logMessage: "SandwichBlocked" },
  { signature: "ImpactTooHigh()", userMessage: "Price impact is too high for this trade.", logMessage: "ImpactTooHigh" },
  { signature: "ExactOutputDuringSnipe()", userMessage: "Exact-output swaps are disabled during anti-snipe.", logMessage: "ExactOutputDuringSnipe" },
];

const SELECTOR_MAP = new Map<string, KnownError>(
  KNOWN_ERRORS.map((e) => [errorSelector(e.signature).toLowerCase(), e]),
);

export type DecodedRevert = {
  selector: Hex;
  signature?: string;
  userMessage: string;
  logMessage: string;
};

/** Strip nested revert data (e.g. `execution reverted: 0x…`). */
export function extractRevertData(err: unknown): Hex | null {
  const msg = err instanceof Error ? err.message : String(err);
  const hexMatch = msg.match(/0x[a-fA-F0-9]{8,}/);
  if (hexMatch) return hexMatch[0] as Hex;
  if (typeof err === "object" && err !== null) {
    const data = (err as { data?: Hex; cause?: { data?: Hex } }).data
      ?? (err as { cause?: { data?: Hex } }).cause?.data;
    if (data && typeof data === "string" && data.startsWith("0x")) return data as Hex;
  }
  return null;
}

/** Decode a revert payload into a user-facing message. Falls back to a short hex prefix. */
export function decodeRevertError(data: Hex | null | undefined): DecodedRevert | null {
  if (!data || data.length < 10) return null;
  const selector = slice(data, 0, 4).toLowerCase() as Hex;
  const known = SELECTOR_MAP.get(selector);
  if (!known) {
    return {
      selector: selector as Hex,
      userMessage: `Transaction reverted (${selector}).`,
      logMessage: `unknown revert ${selector}`,
    };
  }
  return {
    selector: selector as Hex,
    signature: known.signature,
    userMessage: known.userMessage,
    logMessage: known.logMessage,
  };
}

/** Best-effort decode from any thrown value (RPC, viem, wallet). */
export function decodeErrorMessage(err: unknown): string {
  const data = extractRevertData(err);
  const decoded = decodeRevertError(data);
  if (decoded) return decoded.userMessage;
  if (err instanceof Error) return err.message.split("\n")[0] ?? "Unknown error";
  return String(err);
}

/** Indexer / keeper logging — includes selector + decoded name. */
export function formatErrorForLog(err: unknown): string {
  const data = extractRevertData(err);
  const decoded = decodeRevertError(data);
  if (decoded) return decoded.logMessage;
  return err instanceof Error ? err.message : String(err);
}
