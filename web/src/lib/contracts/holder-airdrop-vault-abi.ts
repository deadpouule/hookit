export const holderAirdropVaultAbi = [
  {
    type: "function",
    name: "reserve",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "secondsUntilAirdrop",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastAirdropAt",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "EPOCH",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "airdrop",
    inputs: [
      { name: "token", type: "address" },
      { name: "holders", type: "address[]" },
    ],
    outputs: [{ name: "distributed", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;
