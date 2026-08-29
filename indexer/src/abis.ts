export const launchFactoryAbi = [
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "poolId", type: "bytes32", indexed: false },
      { name: "hooks", type: "address", indexed: false },
      { name: "customHook", type: "bool", indexed: false },
      { name: "tickLower", type: "int24", indexed: false },
      { name: "tickUpper", type: "int24", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LaunchConfigured",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "bitmask", type: "uint256", indexed: false },
      { name: "quote", type: "address", indexed: false },
      { name: "tickSpacing", type: "int24", indexed: false },
      { name: "fee", type: "uint24", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MultiLaunchConfigured",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "marketCount", type: "uint8", indexed: false },
      { name: "floorQuoteIndex", type: "uint8", indexed: false },
      { name: "bitmask", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketLaunched",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "marketIndex", type: "uint8", indexed: true },
      { name: "poolId", type: "bytes32", indexed: false },
      { name: "quote", type: "address", indexed: false },
      { name: "bps", type: "uint16", indexed: false },
      { name: "tickLower", type: "int24", indexed: false },
      { name: "tickUpper", type: "int24", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
    ],
  },
  {
    type: "function",
    name: "launchQuote",
    inputs: [{ name: "launchId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "launchedAt",
    inputs: [{ name: "launchId", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenLaunchId",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const bondingFactoryAbi = [
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "quote", type: "address", indexed: false },
      { name: "graduationQuote", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Bought",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "quoteIn", type: "uint256", indexed: false },
      { name: "tokensOut", type: "uint256", indexed: false },
      { name: "feeQuote", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "tokensIn", type: "uint256", indexed: false },
      { name: "quoteOut", type: "uint256", indexed: false },
      { name: "feeQuote", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Graduated",
    inputs: [
      { name: "launchId", type: "uint256", indexed: true },
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "quoteLp", type: "uint256", indexed: false },
      { name: "tokenLp", type: "uint256", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
    ],
  },
  {
    type: "function",
    name: "launches",
    inputs: [{ name: "launchId", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "creator", type: "address" },
      { name: "quote", type: "address" },
      { name: "phase", type: "uint8" },
      { name: "creatorTaxBps", type: "uint16" },
      { name: "totalSupply", type: "uint256" },
      { name: "curveSupply", type: "uint256" },
      { name: "tokensSold", type: "uint256" },
      { name: "realQuote", type: "uint256" },
      { name: "virtualQuote", type: "uint256" },
      { name: "virtualToken", type: "uint256" },
      { name: "graduationQuote", type: "uint256" },
      { name: "poolId", type: "bytes32" },
      { name: "launchedAt", type: "uint64" },
      { name: "graduatedAt", type: "uint64" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenLaunchId",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const poolManagerAbi = [
  {
    type: "event",
    name: "Swap",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "amount0", type: "int128", indexed: false },
      { name: "amount1", type: "int128", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
      { name: "tick", type: "int24", indexed: false },
      { name: "fee", type: "uint24", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;
