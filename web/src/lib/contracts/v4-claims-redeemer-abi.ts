export const v4ClaimsRedeemerAbi = [
  {
    type: "function",
    name: "claimable",
    inputs: [
      { name: "account", type: "address" },
      { name: "currency", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "currency", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "currency", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "redeemed", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;
