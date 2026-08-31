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

    /// @dev `sqrtPriceX96 ** 2` via 512-bit math — raw multiply overflows at high ticks.
    function _priceX192(uint160 sqrtPriceX96) private pure returns (uint256) {
        return FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1);
    }

    /// @notice Quote value of `tokenAmount` at the current pool sqrt price.
    /// @param tokenIsCurrency0 True when the launched token is `currency0`.
    function quoteFromToken(uint256 tokenAmount, uint160 sqrtPriceX96, bool tokenIsCurrency0)
        internal
        pure
        returns (uint256)
    {
        if (tokenAmount == 0 || sqrtPriceX96 == 0) return 0;
        if (tokenIsCurrency0) {
            // quote (currency1) per token (currency0) = sqrtP^2 / 2^192
            uint256 step = FullMath.mulDiv(tokenAmount, uint256(sqrtPriceX96), FixedPoint96.Q96);
            return FullMath.mulDiv(step, uint256(sqrtPriceX96), FixedPoint96.Q96);
        }
        // quote (currency0) per token (currency1) = 2^192 / sqrtP^2
        uint256 priceX192 = _priceX192(sqrtPriceX96);
        return FullMath.mulDiv(tokenAmount, Q192, priceX192);
    }

    /// @notice Token amount that can be bought with `quoteAmount` at the current sqrt price.
    function tokenFromQuote(uint256 quoteAmount, uint160 sqrtPriceX96, bool tokenIsCurrency0)
        internal
        pure
        returns (uint256)
    {
        if (quoteAmount == 0 || sqrtPriceX96 == 0) return 0;
        if (tokenIsCurrency0) {
            uint256 priceX192 = _priceX192(sqrtPriceX96);
            return FullMath.mulDiv(quoteAmount, Q192, priceX192);
        }
        uint256 step = FullMath.mulDiv(quoteAmount, uint256(sqrtPriceX96), FixedPoint96.Q96);
        return FullMath.mulDiv(step, uint256(sqrtPriceX96), FixedPoint96.Q96);
    }

    /// @notice True when spot is at/below floor, or a sell of `tokenAmount` would push spot through the floor.
    /// @dev Uses current pool liquidity to estimate tokens needed to reach the floor sqrt price.
    function sellWouldBreachFloor(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        bool tokenIsCurrency0,
        uint256 floorReserve,
        uint256 supply,
        uint256 tokenAmount
    ) internal pure returns (bool) {
        if (spotAtOrBelowFloor(sqrtPriceX96, tokenIsCurrency0, floorReserve, supply)) return true;
        if (supply == 0 || floorReserve == 0 || tokenAmount == 0 || liquidity == 0 || sqrtPriceX96 == 0) {
            return false;
        }
        uint160 sqrtFloor = _sqrtPriceAtFloor(floorReserve, supply, tokenIsCurrency0);
        if (sqrtFloor == 0) return false;

        // Selling token moves price toward the floor (token cheaper in quote).
        if (tokenIsCurrency0) {
            // token0 sell = zeroForOne → price down. Floor is below spot when spot > floor.
            if (sqrtPriceX96 <= sqrtFloor) return true;
            uint256 tokensToFloor = _amount0Delta(sqrtFloor, sqrtPriceX96, liquidity);
            return tokenAmount >= tokensToFloor;
        } else {
            // token1 sell = oneForZero → price up. Floor (quote/token) below spot means higher sqrt when token is c1.
            // spot quote/token = 2^192/priceX192; floor below spot ⇒ sqrtPrice above floorSqrt for token=c1.
            if (sqrtPriceX96 >= sqrtFloor) return true;
            uint256 tokensToFloor = _amount1Delta(sqrtPriceX96, sqrtFloor, liquidity);
            return tokenAmount >= tokensToFloor;
        }
    }

    function _sqrtPriceAtFloor(uint256 floorReserve, uint256 supply, bool tokenIsCurrency0)
        private
        pure
        returns (uint160)
    {
        // floor price as currency1/currency0 ratio → encode sqrt.
        // token=c0: quote=c1, price = quote/token = reserve/supply
        // token=c1: quote=c0, price = token/quote = supply/reserve → invert
        if (tokenIsCurrency0) {
            if (supply == 0) return 0;
            uint256 ratioX192 = FullMath.mulDiv(floorReserve, Q192, supply);
            return uint160(_sqrt(ratioX192));
        } else {
            if (floorReserve == 0) return 0;
            uint256 ratioX192 = FullMath.mulDiv(supply, Q192, floorReserve);
            return uint160(_sqrt(ratioX192));
        }
    }

    function _amount0Delta(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) private pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDiv(uint256(liquidity) << 96, sqrtB - sqrtA, uint256(sqrtB) * uint256(sqrtA));
    }

    function _amount1Delta(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) private pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDiv(liquidity, sqrtB - sqrtA, FixedPoint96.Q96);
    }

    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /// @notice True when spot quote-per-token is at or below the backed floor.
    function spotAtOrBelowFloor(uint160 sqrtPriceX96, bool tokenIsCurrency0, uint256 floorReserve, uint256 supply)
        internal
        pure
        returns (bool)
    {
        if (supply == 0 || floorReserve == 0 || sqrtPriceX96 == 0) return false;
        if (tokenIsCurrency0) {
            // spot = priceX192 / 2^192 ; floor = reserve / supply
            // spot <= floor  <=>  priceX192 * supply <= 2^192 * reserve
            uint256 step = FullMath.mulDiv(supply, uint256(sqrtPriceX96), FixedPoint96.Q96);
            return FullMath.mulDiv(step, uint256(sqrtPriceX96), FixedPoint96.Q96) <= floorReserve;
        }
        // spot = 2^192 / priceX192 ; floor = reserve / supply
        // spot <= floor  <=>  2^192 * supply <= priceX192 * reserve
        uint256 priceX192 = _priceX192(sqrtPriceX96);
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

    /// @notice Converts a USD FDV (1e18-scaled) into 18-decimal quote wei using a USD price (1e18-scaled).
    function mcapQuoteFromUsd(uint256 mcapUsdX18, uint256 quoteUsdX18) internal pure returns (uint256) {
        return mcapQuoteWei(mcapUsdX18, quoteUsdX18, 18);
    }

    /// @notice `$4k` FDV in the quote token's native decimals.
    function mcapQuoteWei(uint256 mcapUsdX18, uint256 quoteUsdX18, uint8 decimals) internal pure returns (uint256) {
        if (quoteUsdX18 == 0) revert InvalidPrice();
        uint256 tokensX18 = FullMath.mulDiv(mcapUsdX18, 1e18, quoteUsdX18);
        if (decimals == 18) return tokensX18;
        if (decimals < 18) return tokensX18 / (10 ** (18 - decimals));
        return tokensX18 * (10 ** (decimals - 18));
    }

    /// @notice Starting tick so spot FDV in quote equals `mcapQuoteWei` for a unilateral launch position.
    /// @param tokenIsCurrency1 True when the launched token is `currency1` (native-ETH quote launches).
    function startingTickForMcap(uint256 totalSupply, uint256 mcapQuoteWei, int24 tickSpacing, bool tokenIsCurrency1)
        internal
        pure
        returns (int24)
    {
        if (totalSupply == 0 || mcapQuoteWei == 0) revert InvalidPrice();

        if (tokenIsCurrency1) {
            return _startingTickTokenIsCurrency1(totalSupply, mcapQuoteWei, tickSpacing);
        }
        return _startingTickTokenIsCurrency0(totalSupply, mcapQuoteWei, tickSpacing);
    }

    function _startingTickTokenIsCurrency1(uint256 totalSupply, uint256 mcapQuoteWei, int24 tickSpacing)
        private
        pure
        returns (int24)
    {
        int24 lo = TickMath.minUsableTick(tickSpacing);
        int24 hi = TickMath.maxUsableTick(tickSpacing);

        while (lo < hi) {
            int24 mid = int24(int256(lo) + (int256(hi) - int256(lo) + 1) / 2);
            uint256 mcapAt = quoteFromToken(totalSupply, TickMath.getSqrtPriceAtTick(mid), false);
            if (mcapAt >= mcapQuoteWei) lo = mid;
            else hi = mid - 1;
        }

        return alignTickDown(lo, tickSpacing);
    }

    function _startingTickTokenIsCurrency0(uint256 totalSupply, uint256 mcapQuoteWei, int24 tickSpacing)
        private
        pure
        returns (int24)
    {
        int24 lo = TickMath.minUsableTick(tickSpacing);
        int24 hi = TickMath.maxUsableTick(tickSpacing);

        // Lowest tick where spot FDV meets target — price sits just below `tickLower`.
        while (lo < hi) {
            int24 mid = int24(int256(lo) + (int256(hi) - int256(lo)) / 2);
            uint256 mcapAt = quoteFromToken(totalSupply, TickMath.getSqrtPriceAtTick(mid), true);
            if (mcapAt >= mcapQuoteWei) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        return alignTickUp(lo, tickSpacing);
    }

    error LiquidityOverflow();
    error InvalidPrice();
}
