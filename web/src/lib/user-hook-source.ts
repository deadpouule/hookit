const FORBIDDEN = [
  /forge-std/i,
  /\bfs\.sol\b/i,
  /\bvm\./,
  /\bffi\b/i,
  /\bselfdestruct\b/i,
  /\bdelegatecall\b/i,
  /file:\/\//i,
];

export function prepareUserHookSource(source: string, contractName: string): string {
  for (const re of FORBIDDEN) {
    if (re.test(source)) {
      throw new Error(`Hook source is not allowed to include ${re.source}`);
    }
  }

  let next = source.replace(
    /import\s+\{BaseHook\}\s+from\s+["'][^"']+["']\s*;/,
    'import {BaseHook} from "../base/BaseHook.sol";',
  );
  next = next.replace(
    /contract\s+\w+\s+is\s+BaseHook/,
    `contract ${contractName} is BaseHook`,
  );
  return next;
}
