// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ProtocolConstants
/// @notice Canonical economic parameters for the Hookit launchpad.
library ProtocolConstants {
    uint256 internal constant LAUNCH_FEE_WEI = 0.0005 ether;

    /// @dev Base trading fee: 1% = 100 bps of the quote leg.
    uint16 internal constant BASE_FEE_BPS = 100;
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    /// @dev Split of the 1% base fee (+ snipe tax): 70% creator / 30% protocol.
    uint16 internal constant CREATOR_SHARE_BPS = 7_000;
    uint16 internal constant PROTOCOL_SHARE_BPS = 3_000;

    /// @dev Protocol flywheel: 20% ops / 80% native-token floor.
    uint16 internal constant OPS_SHARE_BPS = 2_000;
    uint16 internal constant FLYWHEEL_SHARE_BPS = 8_000;

    uint16 internal constant MAX_CREATOR_TAX_BPS = 1_000; // 10%
    uint16 internal constant MAX_SNIPE_TAX_BPS = 9_900;
    uint16 internal constant MAX_TX_BPS = 10_000;
    uint16 internal constant MAX_WALLET_BPS = 10_000;
    uint24 internal constant MAX_FLOOR_ALLOCATION_BPS = 10_000;

    uint16 internal constant DEFAULT_INITIAL_SNIPE_TAX_BPS = 5_000;
    uint256 internal constant BUYBACK_VESTING_DURATION = 5 * 365 days;

    int24 internal constant DEFAULT_TICK_SPACING = 60;

    uint24 internal constant DYNAMIC_FEE_FLAG = 0x800000;
}
