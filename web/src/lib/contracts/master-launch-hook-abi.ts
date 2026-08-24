export const masterLaunchHookAbi = [
  {
    type: "function",
    name: "configs",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
