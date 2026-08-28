// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";

/// @notice Builds valid `BitmaskConfig.Modules` from a 9-bit on/off mask (one bit per toggle module).
library ModuleMatrix {
    uint16 internal constant MODULE_COUNT = 9;
    uint16 internal constant MASK_SPACE = 512;

    /// @dev Bit order matches `BitmaskConfig` toggle fields (hook tax is sized from fee sinks).
    uint16 internal constant BIT_ANTI_SNIPE = 1 << 0;
    uint16 internal constant BIT_BACKED_FLOOR = 1 << 1;
    uint16 internal constant BIT_ANTI_MEV = 1 << 2;
    uint16 internal constant BIT_MAX_TX = 1 << 3;
    uint16 internal constant BIT_MAX_WALLET = 1 << 4;
    uint16 internal constant BIT_DYNAMIC_FEES = 1 << 5;
    uint16 internal constant BIT_BUYBACK_VESTING = 1 << 6;
    uint16 internal constant BIT_AUTO_BURN = 1 << 7;
    uint16 internal constant BIT_LP_DONATE = 1 << 8;

    function fromMask(uint16 mask) internal pure returns (BitmaskConfig.Modules memory m) {
        mask = uint16(mask & (MASK_SPACE - 1));
        m.antiSnipe = mask & BIT_ANTI_SNIPE != 0;
        m.backedFloor = mask & BIT_BACKED_FLOOR != 0;
        m.antiMev = mask & BIT_ANTI_MEV != 0;
        m.maxTx = mask & BIT_MAX_TX != 0;
        m.maxWallet = mask & BIT_MAX_WALLET != 0;
        m.dynamicFees = mask & BIT_DYNAMIC_FEES != 0;
        m.buybackVesting = mask & BIT_BUYBACK_VESTING != 0;
        m.autoBurn = mask & BIT_AUTO_BURN != 0;
        m.lpDonate = mask & BIT_LP_DONATE != 0;

        if (m.antiSnipe) {
            m.antiSnipeDurationSeconds = 900;
            m.initialSnipeTaxBps = 1_500;
        }
        if (m.maxTx) m.maxTxBps = 500;
        if (m.maxWallet) m.maxWalletBps = 2_000;
        if (m.backedFloor) m.floorAllocationBps = 1_000;
        if (m.autoBurn) m.autoBurnBps = 1_000;
        if (m.lpDonate) m.lpDonateBps = 1_000;

        // Fee sinks are % of the hook-tax pot — enable a modest hook tax when any sink is on.
        uint256 routed;
        if (m.backedFloor) routed += m.floorAllocationBps;
        if (m.autoBurn) routed += m.autoBurnBps;
        if (m.lpDonate) routed += m.lpDonateBps;
        if (routed > 0) m.hookTaxBps = 200;
    }

    function kitchenSink() internal pure returns (BitmaskConfig.Modules memory m) {
        return fromMask(uint16(MASK_SPACE - 1));
    }

    function maxOpenFeeBps(BitmaskConfig.Modules memory m) internal pure returns (uint256) {
        uint256 openFee = uint256(ProtocolConstants.BASE_FEE_BPS) + m.hookTaxBps;
        if (m.antiSnipe) openFee += m.initialSnipeTaxBps;
        return openFee;
    }
}
