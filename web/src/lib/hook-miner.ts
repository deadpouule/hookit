import { concat, getAddress, keccak256, pad, toHex, type Address, type Hex } from "viem";

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
export { CREATE2_DEPLOYER };
const FLAG_MASK = BigInt(0x3fff);
const MAX_LOOP = 200_000;

export function computeCreate2Address(deployer: Address, salt: Hex, initCodeHash: Hex): Address {
  return getAddress(`0x${keccak256(concat(["0xff", deployer, salt, initCodeHash])).slice(26)}`);
}

export function mineHookSalt(
  creationBytecode: Hex,
  constructorArgs: Hex,
  flags: bigint,
): { salt: Hex; address: Address } {
  const initCodeHash = keccak256(concat([creationBytecode, constructorArgs]));
  for (let i = 0; i < MAX_LOOP; i++) {
    const salt = pad(toHex(i), { size: 32 });
    const address = computeCreate2Address(CREATE2_DEPLOYER, salt, initCodeHash);
    if ((BigInt(address) & FLAG_MASK) === flags) {
      return { salt, address };
    }
  }
  throw new Error("Could not mine a CREATE2 salt for the requested hook flags");
}

const PERM_BITS: Array<[string, number]> = [
  ["beforeInitialize", 13],
  ["afterInitialize", 12],
  ["beforeAddLiquidity", 11],
  ["afterAddLiquidity", 10],
  ["beforeRemoveLiquidity", 9],
  ["afterRemoveLiquidity", 8],
  ["beforeSwap", 7],
  ["afterSwap", 6],
  ["beforeDonate", 5],
  ["afterDonate", 4],
  ["beforeSwapReturnDelta", 3],
  ["afterSwapReturnDelta", 2],
  ["afterAddLiquidityReturnDelta", 1],
  ["afterRemoveLiquidityReturnDelta", 0],
];

export const DEFAULT_CUSTOM_HOOK_FLAGS = (BigInt(1) << BigInt(13)) | (BigInt(1) << BigInt(11));

export function parseHookFlags(source: string): bigint {
  let flags = BigInt(0);
  let matched = false;
  for (const [name, bit] of PERM_BITS) {
    const re = new RegExp(`${name}\\s*:\\s*(true|false)`, "i");
    const hit = source.match(re);
    if (!hit) continue;
    matched = true;
    if (hit[1].toLowerCase() === "true") flags |= BigInt(1) << BigInt(bit);
  }
  return matched ? flags : DEFAULT_CUSTOM_HOOK_FLAGS;
}
