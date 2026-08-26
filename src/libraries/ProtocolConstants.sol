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

    /// @dev Protocol flywheel: 20% ops / 80% HKIT buyback (or legacy floor mode).
    uint16 internal constant OPS_SHARE_BPS = 2_000;
    uint16 internal constant FLYWHEEL_SHARE_BPS = 8_000;

    /// @dev Steady swap fee hard cap: `BASE_FEE_BPS + creatorTaxBps` ≤ 10% (both rails).
    uint16 internal constant MAX_TOTAL_FEE_BPS = 1_000;
    /// @dev Max creator tax so base (1%) + tax ≤ 10%.
    uint16 internal constant MAX_CREATOR_TAX_BPS = 900;
    uint16 internal constant MAX_SNIPE_TAX_BPS = 9_900;

    /// @dev Classic bonding graduation target: 4.2 ETH (or USD-equivalent in quote decimals).
    uint256 internal constant GRADUATION_ETH_WEI = 4.2 ether;

    /// @dev Max Chainlink age for launch FDV / bonding graduation pricing.
    uint256 internal constant ORACLE_MAX_AGE = 1 hours;
    uint16 internal constant MAX_TX_BPS = 10_000;
    uint16 internal constant MAX_WALLET_BPS = 10_000;
    uint24 internal constant MAX_FLOOR_ALLOCATION_BPS = 10_000;
    uint16 internal constant MAX_AUTO_BURN_BPS = 5_000; // 50% of quote-fee pool
    uint16 internal constant MAX_LP_DONATE_BPS = 5_000;

    uint16 internal constant DEFAULT_INITIAL_SNIPE_TAX_BPS = 5_000;
    uint256 internal constant BUYBACK_VESTING_DURATION = 5 * 365 days;

    int24 internal constant DEFAULT_TICK_SPACING = 60;

    uint24 internal constant DYNAMIC_FEE_FLAG = 0x800000;

    /// @dev Fixed fully-diluted valuation at launch ($4,000 with 18-decimal USD scale).
    uint256 internal constant TARGET_LAUNCH_MCAP_USD_X18 = 4_000e18;

    /// @dev Default ETH/USD used to convert the $4k FDV into quote (ETH) at launch.
    uint256 internal constant DEFAULT_LAUNCH_ETH_USD_X18 = 4_000e18;

    /// @dev Canonical launch supply (1 billion tokens, 18 decimals).
    uint256 internal constant DEFAULT_LAUNCH_SUPPLY = 1_000_000_000e18;

    /// @dev Default anti-snipe window for HKIT fair launch.
    uint16 internal constant HKIT_ANTI_SNIPE_DURATION_SECONDS = 3600;
    /// @dev LP donate share of the quote-fee pool for HKIT.
    uint16 internal constant HKIT_LP_DONATE_BPS = 1_000; // 10%
}

