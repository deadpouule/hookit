export const balancedAggregatorAbi = [
  {
    type: "function",
    name: "buyExactInput",
    inputs: [
      { name: "launchId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minTotalOut", type: "uint256" },
      {
        name: "legs",
        type: "tuple[]",
        components: [
          { name: "marketIndex", type: "uint8" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ],
      },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "totalOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sellExactInput",
    inputs: [
      { name: "launchId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minTotalOut", type: "uint256" },
      {
        name: "legs",
        type: "tuple[]",
        components: [
          { name: "marketIndex", type: "uint8" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ],
      },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "totalOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export type BalancedRouteLeg = {
  marketIndex: number;
  amountIn: bigint;
  minAmountOut: bigint;
};
