// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase} from "./utils/LaunchpadTestBase.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {DynamicFeeMath} from "../src/libraries/DynamicFeeMath.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract DynamicFeesTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function packModules(BitmaskConfig.Modules memory m) external pure returns (uint256) {
        return BitmaskConfig.pack(m);
    }

    function _dynamicModules() internal pure returns (BitmaskConfig.Modules memory m) {
        m = defaultModules();
        m.dynamicFees = true;
        m.dynamicFeeMinTotalBps = 100; // 1% total
        m.hookTaxBps = 200; // 3% max total
        m.dynamicFeeRampUp = true;
        m.dynamicFeeDepthSaturationBps = 10_000; // max fee at 100% depth consumption
    }

    function testInRangeQuoteDepth_BuyWithQuoteAsCurrency1() public pure {
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint160 sqrtPrice = TickMath.getSqrtPriceAtTick(0);
        uint128 liquidity = 1_000_000e18;

        uint256 depth = FixedPointMath.inRangeQuoteDepth(
            sqrtPrice, liquidity, tickLower, tickUpper, false, true
        );
        assertGt(depth, 0);
    }

    function testDynamicFeeMath_ScalesWithDepthConsumption() public pure {
        BitmaskConfig.Modules memory m = _dynamicModules();
        uint256 packed = BitmaskConfig.pack(m);

        int24 tickLower = -600;
        int24 tickUpper = 600;
        uint160 sqrtPrice = TickMath.getSqrtPriceAtTick(0);
        uint128 shallow = 1e18;
        uint128 deep = 1e22;

        uint256 shallowDepth = FixedPointMath.inRangeQuoteDepth(
            sqrtPrice, shallow, tickLower, tickUpper, false, true
        );
        uint256 deepDepth = FixedPointMath.inRangeQuoteDepth(
            sqrtPrice, deep, tickLower, tickUpper, false, true
        );
        assertGt(shallowDepth, 0);
        assertGt(deepDepth, shallowDepth);

        uint256 tradeQuote = shallowDepth / 4;
        uint16 shallowTax = DynamicFeeMath.effectiveHookTaxBps(
            packed, tradeQuote, sqrtPrice, shallow, tickLower, tickUpper, false, true
        );
        uint16 deepTax = DynamicFeeMath.effectiveHookTaxBps(
            packed, tradeQuote, sqrtPrice, deep, tickLower, tickUpper, false, true
        );

        assertGt(shallowTax, deepTax);
    }

    function testDynamicFeeMath_SaturatesAtFullDepth() public pure {
        BitmaskConfig.Modules memory m = _dynamicModules();
        uint256 packed = BitmaskConfig.pack(m);

        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint160 sqrtPrice = TickMath.getSqrtPriceAtTick(0);
        uint128 liquidity = 100e18;

        uint256 depth = FixedPointMath.inRangeQuoteDepth(
            sqrtPrice, liquidity, tickLower, tickUpper, false, true
        );
        assertGt(depth, 0);

        uint16 atHalf = DynamicFeeMath.effectiveHookTaxBps(
            packed, depth / 2, sqrtPrice, liquidity, tickLower, tickUpper, false, true
        );
        uint16 atFull = DynamicFeeMath.effectiveHookTaxBps(
            packed, depth, sqrtPrice, liquidity, tickLower, tickUpper, false, true
        );
        uint16 over = DynamicFeeMath.effectiveHookTaxBps(
            packed, depth * 2, sqrtPrice, liquidity, tickLower, tickUpper, false, true
        );

        assertGt(atHalf, 0);
        assertLt(atHalf, atFull);
        assertEq(atFull, 200);
        assertEq(over, 200);
    }

    function testSwap_LargerTradePaysHigherFeeRateThanSmall() public {
        BitmaskConfig.Modules memory m = _dynamicModules();
        (, , PoolId poolId,) = launchToken(m, 60, 1_000_000_000e18);

        MasterLaunchHook.LaunchState memory st = hook.launchState(poolId);
        assertGt(st.seedLiquidity, 0);

        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(st.tickUpper);
        uint160 depthPrice = sqrtUpper - 1;
        uint256 depth = FixedPointMath.inRangeQuoteDepth(
            depthPrice, st.seedLiquidity, st.tickLower, st.tickUpper, !st.tokenIsCurrency0, true
        );
        assertGt(depth, 0);

        uint256 tinyIn = depth / 500;
        uint256 largeIn = depth / 8;
        if (tinyIn == 0) tinyIn = 1;
        if (largeIn <= tinyIn) largeIn = tinyIn * 50;

        uint16 tinyTax = hook.dynamicFeeForSwap(poolId, tinyIn, true);
        uint16 largeTax = hook.dynamicFeeForSwap(poolId, largeIn, true);
        assertGt(largeTax, tinyTax);
    }

    function testEmptyDepthUsesMinHookTax() public pure {
        BitmaskConfig.Modules memory m = _dynamicModules();
        uint256 packed = BitmaskConfig.pack(m);
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint160 sqrtPrice = TickMath.getSqrtPriceAtTick(0);

        // liquidity=0 → depth=0 → must not ramp to max (would revert buys).
        uint16 tax = DynamicFeeMath.effectiveHookTaxBps(
            packed, 1 ether, sqrtPrice, 0, tickLower, tickUpper, false, true
        );
        assertEq(tax, 0, "empty depth stays at min hook tax");
    }

    function testDynamicFeeRangeValidation() public {
        BitmaskConfig.Modules memory m = _dynamicModules();
        m.dynamicFeeMinTotalBps = 291;
        vm.expectRevert(BitmaskConfig.DynamicFeeRangeInvalid.selector);
        this.packModules(m);
    }
}
