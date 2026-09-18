import assert from "node:assert/strict";
import test from "node:test";

import { decodeErrorMessage, decodeRevertError, extractRevertData } from "./errors.js";

test("decodeRevertError maps InsufficientOutput selector", () => {
  // InsufficientOutput()
  const data = "0xbb2875c3" as const;
  const decoded = decodeRevertError(data);
  assert.equal(decoded?.logMessage, "InsufficientOutput");
  assert.match(decoded?.userMessage ?? "", /Slippage|liquidity/i);
});

test("decodeErrorMessage extracts nested revert hex from viem-style errors", () => {
  const err = new Error("Execution reverted with reason: 0xbb2875c30000000000000000000000000000000000000000000000000000000000000000");
  assert.match(decodeErrorMessage(err), /Slippage|liquidity/i);
});

test("extractRevertData returns null for plain strings", () => {
  assert.equal(extractRevertData("network timeout"), null);
});
