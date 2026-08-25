export type CustomHookValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contractName: string | null;
  lineCount: number;
};

export function analyzeCustomHookSource(source: string): CustomHookValidation {
  const trimmed = source.trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trimmed) {
    return { valid: false, errors: ["Paste or upload your hook Solidity source"], warnings, contractName: null, lineCount: 0 };
  }

  const lineCount = trimmed.split("\n").length;

  if (!/pragma\s+solidity/i.test(trimmed)) {
    errors.push("Missing `pragma solidity` directive");
  }

  if (!/\/\/\s*SPDX-License-Identifier/i.test(trimmed)) {
    warnings.push("Add an SPDX license identifier at the top of the file");
  }

  const contractMatch = trimmed.match(/contract\s+(\w+)\s+is\s+(\w+)/);
  const contractName = contractMatch?.[1] ?? null;

  if (!contractMatch) {
    errors.push("Declare a contract that inherits from BaseHook (e.g. `contract MyHook is BaseHook`)");
  } else if (!/BaseHook|IHooks/i.test(contractMatch[2])) {
    errors.push("Hook contract must inherit from BaseHook or implement IHooks");
  }

  if (!/getHookPermissions\s*\(/i.test(trimmed)) {
    errors.push("Implement `getHookPermissions()` — required by Uniswap v4");
  }

  if (!/IPoolManager/i.test(trimmed)) {
    warnings.push("Constructor should accept IPoolManager — Hookit wires the canonical pool manager");
  }

  if (/forge-std|\bvm\.|\bffi\b|selfdestruct|delegatecall/i.test(trimmed)) {
    errors.push("Remove cheatcodes, ffi, selfdestruct, and delegatecall from hook source");
  }

  if (trimmed.length > 48_000) {
    errors.push("Source is too large — keep the hook under ~48 KB for metadata storage");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    contractName,
    lineCount,
  };
}
