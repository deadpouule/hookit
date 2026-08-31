export const buybackVaultAbi = [
  {
    type: "function",
    name: "streams",
    inputs: [
      { name: "beneficiary", type: "address" },
      { name: "launchToken", type: "address" },
    ],
    outputs: [
      { name: "currency", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "start", type: "uint64" },
      { name: "claimed", type: "uint128" },
      { name: "durationSeconds", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vestedOf",
    inputs: [
      { name: "account", type: "address" },
      { name: "launchToken", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
