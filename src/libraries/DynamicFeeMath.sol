// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BitmaskConfig} from "./BitmaskConfig.sol";
import {FixedPointMath} from "./FixedPointMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title DynamicFeeMath
/// @notice LP fee ramps with how much in-range depth a swap consumes — no oracle.
library DynamicFeeMath {
    uint256 internal constant RAMP_SCALE = 1e18;

    /// @notice Hook tax bps for this swap given quote notional vs in-range quote depth.
    function effectiveHookTaxBps(
        uint256 packed,
        uint256 quoteNotional,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tickLower,
        int24 tickUpper,
        bool quoteIsCurrency0,
        bool isBuy
    ) internal pure returns (uint16) {
        if (!BitmaskConfig.enabled(packed, BitmaskConfig.DYNAMIC_FEES_ENABLED)) {
            return BitmaskConfig.hookTaxBps(packed);
        }

        uint16 maxHook = BitmaskConfig.hookTaxBps(packed);
        uint16 minTotal = BitmaskConfig.dynamicFeeMinTotalBps(packed);
        if (minTotal < ProtocolConstants.BASE_FEE_BPS) minTotal = ProtocolConstants.BASE_FEE_BPS;

        uint16 minHook = minTotal > ProtocolConstants.BASE_FEE_BPS ? minTotal - ProtocolConstants.BASE_FEE_BPS : 0;
        if (minHook >= maxHook) return maxHook;

        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        uint160 depthPrice = sqrtPriceX96;
        if (depthPrice <= sqrtLower || depthPrice == 0) {
            depthPrice = sqrtLower + 1;
        } else if (depthPrice >= sqrtUpper) {
            depthPrice = sqrtUpper - 1;
        }

        uint256 depth = FixedPointMath.inRangeQuoteDepth(
            depthPrice, liquidity, tickLower, tickUpper, quoteIsCurrency0, isBuy
        );

        uint16 saturationBps = BitmaskConfig.dynamicFeeDepthSaturationBps(packed);
        if (saturationBps == 0) saturationBps = ProtocolConstants.DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS;

        uint256 ratio;
        if (depth == 0 || quoteNotional == 0) {
            ratio = quoteNotional == 0 ? 0 : RAMP_SCALE;
        } else {
            uint256 consumptionBps = FullMath.mulDiv(quoteNotional, ProtocolConstants.BPS_DENOMINATOR, depth);
            ratio = consumptionBps >= saturationBps
                ? RAMP_SCALE
                : FullMath.mulDiv(consumptionBps, RAMP_SCALE, saturationBps);
        }

        return minHook + uint16(FullMath.mulDiv(uint256(maxHook - minHook), ratio, RAMP_SCALE));
    }
}
