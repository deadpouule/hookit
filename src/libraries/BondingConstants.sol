// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title BondingConstants
/// @notice Defaults for the Classic rail: bonding curve → graduated Uniswap v4 pool.
library BondingConstants {
    /// @dev 1B tokens (18 decimals), same as Hookit master launches.
    uint256 internal constant TOTAL_SUPPLY = 1_000_000_000e18;
    /// @dev 80% sold on the curve; 20% seeded as full-range LP at graduation.
    uint16 internal constant CURVE_SUPPLY_BPS = 8_000;
    /// @dev Virtual ETH reserve at curve open when graduating at 4.2 ETH (scales for other quotes).
    uint256 internal constant VIRTUAL_QUOTE_START_ETH = 1 ether;
    /// @dev Pool fee is always 0 — GraduatedFeeHook charges instead.
    uint24 internal constant POOL_FEE = 0;
    int24 internal constant TICK_SPACING = 60;
    /// @dev Max price impact (bps) for operator sweep swaps that convert token fees → quote.
    uint16 internal constant MAX_SWEEP_IMPACT_BPS = 500;

    /// @dev Alias — creator tax ceiling matches protocol (base + tax ≤ 10%).
    uint16 internal constant MAX_CREATOR_TAX_BPS = ProtocolConstants.MAX_CREATOR_TAX_BPS;
}
