// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";

import {CurrencySettler} from "./CurrencySettler.sol";

/// @title LpDeepenLib
/// @notice External library: route hook-tax quote into the launch tick range as extra liquidity.
/// @dev Linked (not inlined) so MasterLaunchHook stays under EIP-170. DELEGATECALL so settles
///      hit the hook's ERC-6909 claims. Nested swap must run with the hook fee-action flag set.
library LpDeepenLib {
    using CurrencySettler for Currency;
    using StateLibrary for IPoolManager;

    bytes32 internal constant DEEPEN_SALT = keccak256("HOOKIT.DEEPEN");

    error DeepenFailed();

    /// @notice Spend `quoteAmount` of quote claims to mint liquidity on `[tickLower, tickUpper]`.
    ///         Out of range: convert quote→token (or keep quote) for the single-sided side.
    ///         In range: split quote into both assets at the current price, then mint.
    function deepen(
        IPoolManager manager,
        PoolKey calldata key,
        Currency quote,
        bool tokenIsCurrency0,
        int24 tickLower,
        int24 tickUpper,
        uint256 quoteAmount
    ) external {
        if (quoteAmount == 0) return;

        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        uint160 sqrtA = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtB = TickMath.getSqrtPriceAtTick(tickUpper);
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);

        uint256 swapIn = _quoteToSwap(sqrtP, sqrtA, sqrtB, quoteAmount, tokenIsCurrency0);
        uint256 tokenOut;
        uint256 quoteLeft = quoteAmount;

        if (swapIn > 0) {
            bool zeroForOne = !tokenIsCurrency0;
            BalanceDelta swapDelta = manager.swap(
                key,
                SwapParams({
                    zeroForOne: zeroForOne,
                    amountSpecified: -int256(swapIn),
                    sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
                }),
                ""
            );
            int128 quoteDelta = zeroForOne ? swapDelta.amount0() : swapDelta.amount1();
            int128 tokenDelta = zeroForOne ? swapDelta.amount1() : swapDelta.amount0();
            uint256 quotePaid = quoteDelta < 0 ? uint256(uint128(-quoteDelta)) : 0;
            tokenOut = tokenDelta > 0 ? uint256(uint128(tokenDelta)) : 0;
            if (quotePaid == 0 || tokenOut == 0) revert DeepenFailed();
            quote.settle(manager, address(this), quotePaid, true);
            Currency tokenCur = tokenIsCurrency0 ? key.currency0 : key.currency1;
            tokenCur.take(manager, address(this), tokenOut, true);
            quoteLeft = quoteAmount - quotePaid;
        }

        uint256 amount0 = tokenIsCurrency0 ? tokenOut : quoteLeft;
        uint256 amount1 = tokenIsCurrency0 ? quoteLeft : tokenOut;

        (uint160 sqrtNow,,,) = manager.getSlot0(key.toId());
        uint128 liq = _liquidityForAmounts(sqrtNow, sqrtA, sqrtB, amount0, amount1);
        if (liq == 0) revert DeepenFailed();

        (BalanceDelta liqDelta,) = manager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: int256(uint256(liq)), salt: DEEPEN_SALT
            }),
            ""
        );
        _settleMint(manager, key, liqDelta);
    }

    function _quoteToSwap(uint160 sqrtP, uint160 sqrtA, uint160 sqrtB, uint256 quoteAmount, bool tokenIsCurrency0)
        private
        pure
        returns (uint256 swapIn)
    {
        uint128 probe = 1e18;
        uint256 amt0;
        uint256 amt1;
        if (sqrtP <= sqrtA) {
            amt0 = _amount0(sqrtA, sqrtB, probe);
        } else if (sqrtP >= sqrtB) {
            amt1 = _amount1(sqrtA, sqrtB, probe);
        } else {
            amt0 = _amount0(sqrtP, sqrtB, probe);
            amt1 = _amount1(sqrtA, sqrtP, probe);
        }

        bool quoteIsC0 = !tokenIsCurrency0;
        uint256 quoteShare;
        if (quoteIsC0) {
            uint256 amt1AsQuote = _value1As0(amt1, sqrtP);
            uint256 total = amt0 + amt1AsQuote;
            quoteShare = total == 0 ? quoteAmount : FullMath.mulDiv(quoteAmount, amt0, total);
        } else {
            uint256 amt0AsQuote = _value0As1(amt0, sqrtP);
            uint256 total = amt1 + amt0AsQuote;
            quoteShare = total == 0 ? quoteAmount : FullMath.mulDiv(quoteAmount, amt1, total);
        }
        if (quoteShare >= quoteAmount) return 0;
        return quoteAmount - quoteShare;
    }

    function _settleMint(IPoolManager manager, PoolKey calldata key, BalanceDelta d) private {
        if (d.amount0() < 0) {
            key.currency0.settle(manager, address(this), uint256(uint128(-d.amount0())), true);
        } else if (d.amount0() > 0) {
            key.currency0.take(manager, address(this), uint256(uint128(d.amount0())), true);
        }
        if (d.amount1() < 0) {
            key.currency1.settle(manager, address(this), uint256(uint128(-d.amount1())), true);
        } else if (d.amount1() > 0) {
            key.currency1.take(manager, address(this), uint256(uint128(d.amount1())), true);
        }
    }

    function _value0As1(uint256 amount0, uint160 sqrtP) private pure returns (uint256) {
        if (amount0 == 0 || sqrtP == 0) return 0;
        uint256 mid = FullMath.mulDiv(amount0, sqrtP, FixedPoint96.Q96);
        return FullMath.mulDiv(mid, sqrtP, FixedPoint96.Q96);
    }

    function _value1As0(uint256 amount1, uint160 sqrtP) private pure returns (uint256) {
        if (amount1 == 0 || sqrtP == 0) return 0;
        uint256 mid = FullMath.mulDiv(amount1, FixedPoint96.Q96, sqrtP);
        return FullMath.mulDiv(mid, FixedPoint96.Q96, sqrtP);
    }

    function _amount0(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) private pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDiv(uint256(liquidity) << 96, sqrtB - sqrtA, uint256(sqrtB) * uint256(sqrtA));
    }

    function _amount1(uint160 sqrtA, uint160 sqrtB, uint128 liquidity) private pure returns (uint256) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        return FullMath.mulDiv(liquidity, sqrtB - sqrtA, FixedPoint96.Q96);
    }

    function _liquidityForAmount0(uint160 sqrtA, uint160 sqrtB, uint256 amount0) private pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        uint256 intermediate = FullMath.mulDiv(sqrtA, sqrtB, FixedPoint96.Q96);
        uint256 liq = FullMath.mulDiv(amount0, intermediate, sqrtB - sqrtA);
        if (liq > type(uint128).max) revert DeepenFailed();
        return uint128(liq);
    }

    function _liquidityForAmount1(uint160 sqrtA, uint160 sqrtB, uint256 amount1) private pure returns (uint128) {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        uint256 liq = FullMath.mulDiv(amount1, FixedPoint96.Q96, sqrtB - sqrtA);
        if (liq > type(uint128).max) revert DeepenFailed();
        return uint128(liq);
    }

    function _liquidityForAmounts(uint160 sqrtP, uint160 sqrtA, uint160 sqrtB, uint256 amount0, uint256 amount1)
        private
        pure
        returns (uint128 liquidity)
    {
        if (sqrtA > sqrtB) (sqrtA, sqrtB) = (sqrtB, sqrtA);
        if (sqrtP <= sqrtA) {
            if (amount0 == 0) return 0;
            return _liquidityForAmount0(sqrtA, sqrtB, amount0);
        }
        if (sqrtP >= sqrtB) {
            if (amount1 == 0) return 0;
            return _liquidityForAmount1(sqrtA, sqrtB, amount1);
        }
        uint128 liq0 = amount0 == 0 ? 0 : _liquidityForAmount0(sqrtP, sqrtB, amount0);
        uint128 liq1 = amount1 == 0 ? 0 : _liquidityForAmount1(sqrtA, sqrtP, amount1);
        if (liq0 == 0) return liq1;
        if (liq1 == 0) return liq0;
        return liq0 < liq1 ? liq0 : liq1;
    }
}
