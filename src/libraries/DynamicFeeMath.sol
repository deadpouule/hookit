// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {BitmaskConfig} from "./BitmaskConfig.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title DynamicFeeMath
/// @notice Rolling 24h quote volume → linear hook-tax ramp between configured min/max totals.
library DynamicFeeMath {
    uint256 internal constant RAMP_SCALE = 1e18;
    uint256 internal constant VOLUME_UNIT = 1e18;

    /// @notice Quote volume in the current window that fully saturates the ramp.
    function volumeTarget(uint16 scale) internal pure returns (uint256) {
        if (scale == 0) return ProtocolConstants.DYNAMIC_FEE_DEFAULT_TARGET_QUOTE;
        return uint256(scale) * VOLUME_UNIT;
    }

    /// @notice Hook tax bps for this swap given rolling-window quote volume (pre-swap).
    function effectiveHookTaxBps(uint256 packed, uint256 volume) internal pure returns (uint16) {
        if (!BitmaskConfig.enabled(packed, BitmaskConfig.DYNAMIC_FEES_ENABLED)) {
            return BitmaskConfig.hookTaxBps(packed);
        }

        uint16 maxHook = BitmaskConfig.hookTaxBps(packed);
        uint16 minTotal = BitmaskConfig.dynamicFeeMinTotalBps(packed);
        if (minTotal < ProtocolConstants.BASE_FEE_BPS) minTotal = ProtocolConstants.BASE_FEE_BPS;

        uint16 minHook = minTotal > ProtocolConstants.BASE_FEE_BPS ? minTotal - ProtocolConstants.BASE_FEE_BPS : 0;
        if (minHook >= maxHook) return maxHook;

        uint256 target = volumeTarget(BitmaskConfig.dynamicFeeVolumeTargetScale(packed));
        uint256 ratio = volume >= target ? RAMP_SCALE : FullMath.mulDiv(volume, RAMP_SCALE, target);

        if (BitmaskConfig.enabled(packed, BitmaskConfig.DYNAMIC_FEE_RAMP_UP_ENABLED)) {
            return minHook + uint16(FullMath.mulDiv(uint256(maxHook - minHook), ratio, RAMP_SCALE));
        }
        return maxHook - uint16(FullMath.mulDiv(uint256(maxHook - minHook), ratio, RAMP_SCALE));
    }

    function windowVolume(uint256 windowPacked) internal pure returns (uint256) {
        return windowPacked & type(uint192).max;
    }

    function windowStart(uint256 windowPacked) internal pure returns (uint64) {
        return uint64(windowPacked >> 192);
    }

    /// @dev Upper 64 bits = window start timestamp; lower 192 bits = quote volume in window.
    function accrueVolume(uint256 windowPacked, uint256 quoteNotional, uint256 nowTs) internal pure returns (uint256) {
        uint64 start = windowStart(windowPacked);
        uint256 volume = windowVolume(windowPacked);

        if (start == 0 || nowTs >= uint256(start) + ProtocolConstants.DYNAMIC_FEE_WINDOW_SECONDS) {
            start = uint64(nowTs);
            volume = 0;
        }
        volume += quoteNotional;
        return (uint256(start) << 192) | volume;
    }
}
