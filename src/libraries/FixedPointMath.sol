// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title FixedPointMath
/// @notice Tick alignment, quote conversion, decaying snipe tax, and floor arithmetic.
library FixedPointMath {
    uint256 internal constant Q192 = 1 << 192;

    function alignTickDown(int24 tick, int24 tickSpacing) internal pure returns (int24 aligned) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        aligned = compressed * tickSpacing;
    }

    function alignTickUp(int24 tick, int24 tickSpacing) internal pure returns (int24 aligned) {
        aligned = alignTickDown(tick, tickSpacing);
        if (aligned < tick) aligned += tickSpacing;
    }

    /// @notice Linear decaying snipe tax: InitialTax * (1 - elapsed/duration).
    function snipeTaxBps(uint16 initialTaxBps, uint256 launchTimestamp, uint16 durationSeconds, uint256 nowTs)
        internal
        pure
        returns (uint16)
    {
        if (durationSeconds == 0 || nowTs <= launchTimestamp) return initialTaxBps;
        uint256 elapsed = nowTs - launchTimestamp;
        if (elapsed >= durationSeconds) return 0;
        uint256 remaining = uint256(initialTaxBps) * (uint256(durationSeconds) - elapsed) / uint256(durationSeconds);
        return uint16(remaining);
    }

    function applyBps(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return FullMath.mulDiv(amount, bps, ProtocolConstants.BPS_DENOMINATOR);
    }

    /// @notice Quote received for `tokenAmount` at the backed floor (round down).
    function quoteAtFloor(uint256 tokenAmount, uint256 floorReserve, uint256 circulatingSupply)
        internal
        pure
        returns (uint256)
    {
        if (circulatingSupply == 0 || floorReserve == 0 || tokenAmount == 0) return 0;
        return FullMath.mulDiv(tokenAmount, floorReserve, circulatingSupply);
    }

    /// @notice Floor price as quote-wei per token-wei, 1e18 scaled: reserve * 1e18 / supply.
    function floorPriceX18(uint256 floorReserve, uint256 circulatingSupply) internal pure returns (uint256) {
        if (circulatingSupply == 0) return 0;
        return FullMath.mulDiv(floorReserve, 1e18, circulatingSupply);
    }

    /// @notice Quote value of `tokenAmount` at the current pool sqrt price.
    /// @param tokenIsCurrency0 True when the launched token is `currency0`.
    function quoteFromToken(uint256 tokenAmount, uint160 sqrtPriceX96, bool tokenIsCurrency0)
        internal
        pure
        returns (uint256)
    {
        if (tokenAmount == 0 || sqrtPriceX96 == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (tokenIsCurrency0) {
            // quote (currency1) per token (currency0) = sqrtP^2 / 2^192
            return FullMath.mulDiv(tokenAmount, priceX192, Q192);
        }
        // quote (currency0) per token (currency1) = 2^192 / sqrtP^2
        return FullMath.mulDiv(tokenAmount, Q192, priceX192);
    }

    /// @notice Token amount that can be bought with `quoteAmount` at the current sqrt price.
    function tokenFromQuote(uint256 quoteAmount, uint160 sqrtPriceX96, bool tokenIsCurrency0)
        internal
        pure
        returns (uint256)
    {
        if (quoteAmount == 0 || sqrtPriceX96 == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (tokenIsCurrency0) {
            return FullMath.mulDiv(quoteAmount, Q192, priceX192);
        }
        return FullMath.mulDiv(quoteAmount, priceX192, Q192);
    }

    /// @notice True when spot quote-per-token is at or below the backed floor.
    function spotAtOrBelowFloor(uint160 sqrtPriceX96, bool tokenIsCurrency0, uint256 floorReserve, uint256 supply)
        internal
        pure
        returns (bool)
    {
        if (supply == 0 || floorReserve == 0 || sqrtPriceX96 == 0) return false;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (tokenIsCurrency0) {
            // spot = priceX192 / 2^192 ; floor = reserve / supply
            // spot <= floor  <=>  priceX192 * supply <= 2^192 * reserve
            return FullMath.mulDiv(priceX192, supply, Q192) <= floorReserve;
        }
        // spot = 2^192 / priceX192 ; floor = reserve / supply
        // spot <= floor  <=>  2^192 * supply <= priceX192 * reserve
        return FullMath.mulDiv(Q192, supply, priceX192) <= floorReserve;
    }

    /// @notice Liquidity for a single-sided token1 position covering [sqrtA, sqrtB].
    function liquidityForAmount1(uint160 sqrtA, uint160 sqrtB, uint256 amount1) internal pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        uint256 liq = FullMath.mulDiv(amount1, FixedPoint96.Q96, uint256(sqrtB) - uint256(sqrtA));
        if (liq > type(uint128).max) revert LiquidityOverflow();
        return uint128(liq);
    }

    /// @notice Liquidity for a single-sided token0 position covering [sqrtA, sqrtB].
    function liquidityForAmount0(uint160 sqrtA, uint160 sqrtB, uint256 amount0) internal pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        uint256 intermediate = FullMath.mulDiv(sqrtA, sqrtB, FixedPoint96.Q96);
        uint256 liq = FullMath.mulDiv(amount0, intermediate, uint256(sqrtB) - uint256(sqrtA));
        if (liq > type(uint128).max) revert LiquidityOverflow();
        return uint128(liq);
    }

    function getSqrtPriceAtTick(int24 tick) internal pure returns (uint160) {
        return TickMath.getSqrtPriceAtTick(tick);
    }

    error LiquidityOverflow();
}
