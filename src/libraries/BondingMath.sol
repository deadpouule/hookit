// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {FixedPointMath} from "./FixedPointMath.sol";
import {BondingConstants} from "./BondingConstants.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title BondingMath
/// @notice Constant-product bonding curve + full-range LP helpers for classic launches.
library BondingMath {
    error ZeroAmount();
    error InsufficientLiquidity();
    error InvalidReserves();

    function curveSupply(uint256 totalSupply) internal pure returns (uint256) {
        return FullMath.mulDiv(totalSupply, BondingConstants.CURVE_SUPPLY_BPS, ProtocolConstants.BPS_DENOMINATOR);
    }

    function lpSupply(uint256 totalSupply) internal pure returns (uint256) {
        return totalSupply - curveSupply(totalSupply);
    }

    /// @notice Quote required to buy exact `tokensOut` (before trading fee).
    function quoteInForTokensOut(uint256 virtualQuote, uint256 virtualToken, uint256 tokensOut)
        internal
        pure
        returns (uint256 quoteIn, uint256 newVirtualQuote, uint256 newVirtualToken)
    {
        if (tokensOut == 0) revert ZeroAmount();
        if (virtualQuote == 0 || virtualToken == 0 || tokensOut >= virtualToken) revert InsufficientLiquidity();
        newVirtualToken = virtualToken - tokensOut;
        uint256 k = virtualQuote * virtualToken;
        newVirtualQuote = (k + newVirtualToken - 1) / newVirtualToken; // ceil
        if (newVirtualQuote <= virtualQuote) revert InsufficientLiquidity();
        quoteIn = newVirtualQuote - virtualQuote;
    }

    /// @notice Tokens out for `quoteIn` against virtual constant-product reserves.
    function buyQuoteIn(uint256 virtualQuote, uint256 virtualToken, uint256 quoteIn)
        internal
        pure
        returns (uint256 tokensOut, uint256 newVirtualQuote, uint256 newVirtualToken)
    {
        if (quoteIn == 0) revert ZeroAmount();
        if (virtualQuote == 0 || virtualToken == 0) revert InvalidReserves();
        newVirtualQuote = virtualQuote + quoteIn;
        uint256 k = virtualQuote * virtualToken;
        newVirtualToken = k / newVirtualQuote;
        if (newVirtualToken >= virtualToken) revert InsufficientLiquidity();
        tokensOut = virtualToken - newVirtualToken;
    }

    /// @notice Quote out for `tokensIn` against virtual constant-product reserves.
    function sellTokenIn(uint256 virtualQuote, uint256 virtualToken, uint256 tokensIn)
        internal
        pure
        returns (uint256 quoteOut, uint256 newVirtualQuote, uint256 newVirtualToken)
    {
        if (tokensIn == 0) revert ZeroAmount();
        if (virtualQuote == 0 || virtualToken == 0) revert InvalidReserves();
        newVirtualToken = virtualToken + tokensIn;
        uint256 k = virtualQuote * virtualToken;
        newVirtualQuote = k / newVirtualToken;
        if (newVirtualQuote >= virtualQuote) revert InsufficientLiquidity();
        quoteOut = virtualQuote - newVirtualQuote;
    }

    /// @notice `sqrt(amount1/amount0) * 2^96` for ETH(currency0) / token(currency1) pools.
    function sqrtPriceFromReserves(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        if (amount0 == 0 || amount1 == 0) revert InvalidReserves();
        uint256 ratioX192 = FullMath.mulDiv(amount1, 1 << 192, amount0);
        return uint160(_sqrt(ratioX192));
    }

    /// @notice Liquidity for a full-range position given both sides and the current price.
    function liquidityFullRange(uint160 sqrtPriceX96, int24 tickSpacing, uint256 amount0, uint256 amount1)
        internal
        pure
        returns (uint128 liquidity, int24 tickLower, int24 tickUpper)
    {
        tickLower = TickMath.minUsableTick(tickSpacing);
        tickUpper = TickMath.maxUsableTick(tickSpacing);
        uint160 sqrtA = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtB = TickMath.getSqrtPriceAtTick(tickUpper);

        if (sqrtPriceX96 <= sqrtA) {
            liquidity = FixedPointMath.liquidityForAmount0(sqrtA, sqrtB, amount0);
        } else if (sqrtPriceX96 >= sqrtB) {
            liquidity = FixedPointMath.liquidityForAmount1(sqrtA, sqrtB, amount1);
        } else {
            uint128 liq0 = FixedPointMath.liquidityForAmount0(sqrtPriceX96, sqrtB, amount0);
            uint128 liq1 = FixedPointMath.liquidityForAmount1(sqrtA, sqrtPriceX96, amount1);
            liquidity = liq0 < liq1 ? liq0 : liq1;
        }
    }

    /// @dev Babylonian square root (Uniswap-style).
    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
