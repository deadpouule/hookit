// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title QuotronsInk
/// @notice Live Quotrons / Ink addresses for fee rails — no Hookit-seeded ETH/USDG LP.
/// @dev From Quotrons "Build on QUOTRONS II" (Ink mainnet). Their WETH terminal pot
///      converts donated WETH → USDT0 → USDG (keeper path). There is currently no
///      public reverse USDG→ETH/WETH v4 pool; `EthUsdgBridgeLib.tryWireBest` wires
///      FeeEthRail only when such a pool appears. Never initialize an empty Hookit LP.
library QuotronsInk {
    uint256 internal constant CHAIN_ID = 57073;

    address internal constant WETH = 0x4200000000000000000000000000000000000006; // OP-stack canonical
    address internal constant USDG = 0xe343167631d89B6Ffc58B88d6b7fB0228795491D;
    /// @dev Stargate USDT0 on Ink — Quotrons WETH terminal pot mid (`usdt0()`).
    address internal constant USDT0 = 0x0200C29006150606B650577BBE7B6248F58470c1;

    address internal constant STOCK_HOOK = 0x8bb4516059F9149Bc3b89018Fc7537f1F14a30cc;
    address internal constant POOL_FACTORY = 0xbFA531C90FD9e42aC13Af14823B30e40761dd3A2;
    address internal constant EPOCH_CONVERTER = 0xFd30F33dE4A2dA00c5c844Acef5728535B95B33F;
    address internal constant TERMINAL_DIVIDENDS = 0x2E1509FBc75b621d08F64d8328a3C4152cf96C2C;
    /// @dev Accepts WETH donations; routes WETH → USDT0 → USDG for terminal rewards.
    address internal constant WETH_TERMINAL_POT = 0x0Aa7abB778DC11Dcaa1dBB16B72c70dD6f2d7A07;
    /// @dev Accepts WETH donations; 50/50 stock+USDG POL into Quotrons equity pools.
    address internal constant LIQUIDITY_GROWTH_SINK = 0x73F5111EE91672c114923793C03B5c868d9C5E03;
    address internal constant LP_VAULT_BEACON = 0x6560417F6Df140597c3d2811ED833cD9a70e7D78;
}
