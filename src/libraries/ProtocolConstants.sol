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
    ///      Hook tax is separate and never enters this split — it funds Master hook modules.
    uint16 internal constant CREATOR_SHARE_BPS = 7_000;
    uint16 internal constant PROTOCOL_SHARE_BPS = 3_000;

    /// @dev Protocol flywheel: 20% ops / 80% HKIT buyback (or legacy floor mode).
    uint16 internal constant OPS_SHARE_BPS = 2_000;
    uint16 internal constant FLYWHEEL_SHARE_BPS = 8_000;

    /// @dev Steady swap fee hard cap: `BASE_FEE_BPS + hookTaxBps` ≤ 10% (Master).
    uint16 internal constant MAX_TOTAL_FEE_BPS = 1_000;
    /// @dev Max hook tax so base (1%) + hook tax ≤ 10%. Routes to Master modules only.
    uint16 internal constant MAX_HOOK_TAX_BPS = 900;
    uint16 internal constant MAX_SNIPE_TAX_BPS = 9_900;

    /// @dev Classic bonding graduation target: 4.2 ETH (or USD-equivalent in quote decimals).
    uint256 internal constant GRADUATION_ETH_WEI = 4.2 ether;

    /// @dev Max Chainlink age for launch FDV / bonding graduation pricing.
    uint256 internal constant ORACLE_MAX_AGE = 1 hours;
    /// @dev Max tx / max wallet (% of total supply). Launcher picks between min and max at launch.
    uint16 internal constant MIN_TX_BPS = 10;
    uint16 internal constant MAX_TX_BPS = 250;
    uint16 internal constant MIN_WALLET_BPS = 10;
    uint16 internal constant MAX_WALLET_BPS = 250;
    uint24 internal constant MAX_FLOOR_ALLOCATION_BPS = 10_000;
    uint16 internal constant MAX_AUTO_BURN_BPS = 10_000;
    uint16 internal constant MAX_LP_DONATE_BPS = 10_000;
    /// @dev Max share of the quote-fee pool routed to holder airdrops (100% — combined routes capped at 100%).
    uint16 internal constant MAX_HOLDER_AIRDROP_BPS = 10_000;
    /// @dev Minimum time between permissionless holder airdrops.
    uint256 internal constant HOLDER_AIRDROP_EPOCH = 15 minutes;

    uint16 internal constant DEFAULT_INITIAL_SNIPE_TAX_BPS = 5_000;
    uint256 internal constant BUYBACK_VESTING_DURATION = 5 * 365 days;
    uint32 internal constant MIN_BUYBACK_VESTING_DURATION = 7 days;
    uint32 internal constant MAX_BUYBACK_VESTING_DURATION = uint32(BUYBACK_VESTING_DURATION);

    int24 internal constant DEFAULT_TICK_SPACING = 60;

    uint24 internal constant DYNAMIC_FEE_FLAG = 0x800000;

    /// @dev Rolling window for on-chain dynamic fee volume (quote notional).
    uint256 internal constant DYNAMIC_FEE_WINDOW_SECONDS = 24 hours;
    /// @dev Min gap between dynamic min/max total fees (0.10%).
    uint16 internal constant MIN_DYNAMIC_FEE_TOTAL_GAP_BPS = 10;
    /// @dev Default saturation: 10 quote units (1e19 wei for 18-decimal quote) per 24h.
    uint16 internal constant DYNAMIC_FEE_DEFAULT_VOLUME_TARGET_SCALE = 10;
    uint256 internal constant DYNAMIC_FEE_DEFAULT_TARGET_QUOTE = 10e18;

    /// @dev Fixed fully-diluted valuation at launch ($4,000 with 18-decimal USD scale).
    uint256 internal constant TARGET_LAUNCH_MCAP_USD_X18 = 4_000e18;

    /// @dev Default ETH/USD used to convert the $4k FDV into quote (ETH) at launch.
    uint256 internal constant DEFAULT_LAUNCH_ETH_USD_X18 = 4_000e18;

    /// @dev Canonical launch supply (1 billion tokens, 18 decimals).
    uint256 internal constant DEFAULT_LAUNCH_SUPPLY = 1_000_000_000e18;

    /// @dev Optional creator dev buy cap: 2.5% of total supply per launch.
    uint16 internal constant MAX_DEV_BUY_BPS = 250;

    /// @dev Multi-market launches: 1–5 independent v4 pools per token (PAIR-style).
    uint8 internal constant MIN_LAUNCH_MARKETS = 1;
    uint8 internal constant MAX_LAUNCH_MARKETS = 5;

    /// @dev Default anti-snipe window for HKIT fair launch.
    uint16 internal constant HKIT_ANTI_SNIPE_DURATION_SECONDS = 3600;
    /// @dev LP donate share of the quote-fee pool for HKIT.
    uint16 internal constant HKIT_LP_DONATE_BPS = 1_000; // 10%
}

