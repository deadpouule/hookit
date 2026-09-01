// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {DynamicFeeMath} from "../src/libraries/DynamicFeeMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract DynamicFeesTest is LaunchpadTestBase {
    function setUp() public {
        deployProtocol();
    }

    function packModules(BitmaskConfig.Modules memory m) external pure returns (uint256) {
        return BitmaskConfig.pack(m);
    }

    function _dynamicModules(bool rampUp) internal pure returns (BitmaskConfig.Modules memory m) {
        m = defaultModules();
        m.dynamicFees = true;
        m.dynamicFeeMinTotalBps = 100; // 1% total
        m.hookTaxBps = 200; // 3% max total
        m.dynamicFeeRampUp = rampUp;
        m.dynamicFeeVolumeTargetScale = 1; // saturate at 1e18 quote / 24h
    }

    function testDynamicFeeMath_RampUp() public pure {
        uint256 packed = BitmaskConfig.pack(_dynamicModules(true));
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 0), 0);
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 0.5e18), 100);
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 1e18), 200);
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 2e18), 200);
    }

    function testDynamicFeeMath_RampDown() public pure {
        uint256 packed = BitmaskConfig.pack(_dynamicModules(false));
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 0), 200);
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 0.5e18), 100);
        assertEq(DynamicFeeMath.effectiveHookTaxBps(packed, 1e18), 0);
    }

    function testSwap_RampUp_LowVolumeUsesMinSideOfRange() public {
        BitmaskConfig.Modules memory m = _dynamicModules(true);
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 0.01 ether);
        uint256 lowVolCreator = escrow.balanceOf(address(this), Currency.wrap(address(0))) - creatorBefore;

        buyExactIn(key, 1.1 ether);

        creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 0.1 ether);
        uint256 highVolCreator = escrow.balanceOf(address(this), Currency.wrap(address(0))) - creatorBefore;

        (,, uint16 hookTax) = hook.dynamicFeeSnapshot(poolId);
        assertEq(hookTax, 200);
        assertGt(highVolCreator, lowVolCreator);
        token;
    }

    function testSwap_RampDown_HighVolumeMovesTowardMin() public {
        BitmaskConfig.Modules memory m = _dynamicModules(false);
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 0.01 ether);
        (,, uint16 hookTaxAfterSmall) = hook.dynamicFeeSnapshot(poolId);
        assertEq(hookTaxAfterSmall, 198);

        buyExactIn(key, 1.1 ether);
        (,, uint16 hookTaxAfterLarge) = hook.dynamicFeeSnapshot(poolId);
        assertEq(hookTaxAfterLarge, 0);
        token;
        poolId;
        key;
    }

    function testSwap_RampUp_ReachesMaxAfterVolume() public {
        BitmaskConfig.Modules memory m = _dynamicModules(true);
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 1.1 ether);

        (,, uint16 hookTax) = hook.dynamicFeeSnapshot(poolId);
        assertEq(hookTax, 200);

        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 0.1 ether);
        uint256 creatorAfter = escrow.balanceOf(address(this), Currency.wrap(address(0)));

        assertApproxEqAbs(creatorAfter - creatorBefore, 0.0007 ether, 0.0002 ether);
        token;
        poolId;
        key;
    }

    function testDynamicFeeRangeValidation() public {
        BitmaskConfig.Modules memory m = _dynamicModules(true);
        m.dynamicFeeMinTotalBps = 291;
        vm.expectRevert(BitmaskConfig.DynamicFeeRangeInvalid.selector);
        this.packModules(m);
    }
}
