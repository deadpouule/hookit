export const protocolRevenueDistributorAbi = [
  {
    type: "function",
    name: "buybackEth",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nativeToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const hkitBuybackAbi = [
  {
    type: "function",
    name: "hkit",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BuybackBurned",
    inputs: [
      { name: "ethIn", type: "uint256", indexed: false },
      { name: "tokensBurned", type: "uint256", indexed: false },
      { name: "caller", type: "address", indexed: true },
    ],
  },
] as const;
