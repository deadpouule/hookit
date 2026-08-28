// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {IMasterLaunchHook} from "../src/interfaces/IMasterLaunchHook.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

contract MasterLaunchHookTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function testLaunchAtomicUnilateral() public {
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000e18);
        assertLt(LaunchTokenLike(token).balanceOf(address(factory)), 1e15);
        IMasterLaunchHook.LaunchState memory st = hook.launchState(poolId);
        assertEq(st.creator, address(this));
        assertEq(st.token, token);
        assertTrue(st.initialized);
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        assertGt(sqrtPriceX96, 0);
        key;
    }

    function testBuyLiveFromBlockZero() public {
        (, address token,, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000_000e18);
        uint256 beforeBal = LaunchTokenLike(token).balanceOf(address(this));
        buyExactIn(key, 1 ether);
        assertGt(LaunchTokenLike(token).balanceOf(address(this)), beforeBal);
    }

    function testRemoveLaunchLiquidityReverts() public {
        (uint256 launchId,, PoolId poolId, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000e18);
        (,,,,, int24 tickLower, int24 tickUpper,) = factory.launches(launchId);
        IMasterLaunchHook.LaunchState memory st = hook.launchState(poolId);
        assertEq(st.tickLower, tickLower);
        assertEq(st.tickUpper, tickUpper);
        vm.startPrank(address(manager));
        vm.expectRevert(MasterLaunchHook.LaunchPositionLocked.selector);
        hook.beforeRemoveLiquidity(
            address(factory),
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -1, salt: bytes32(0)}),
            ""
        );
        vm.stopPrank();
    }

    function testCreatorShareToHook_FundsModulesNotEscrow() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 0;
        m.creatorShareToHook = true;
        m.backedFloor = true;
        m.floorAllocationBps = 10_000; // 100% of hook pot → floor
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        uint256 floorBefore = vault.reserve(token);
        buyExactIn(key, 10 ether);

        // Creator's 70% of base went to the hook pot → floor, not escrow.
        assertEq(escrow.balanceOf(address(this), Currency.wrap(address(0))), creatorBefore);
        assertGt(vault.reserve(token), floorBefore);
        // Protocol still gets 30% of base.
        assertGt(distributor.pending(Currency.wrap(address(0))), 0);
    }

    function testQuoteOnlyFeesCreditCreatorAndProtocol() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 100; // +1%
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 10 ether);

        uint256 creatorAfter = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        assertGt(creatorAfter, creatorBefore);
        assertGt(distributor.pending(Currency.wrap(address(0))), 0);
        // No launched-token fees: creator escrow is native quote only.
        assertEq(escrow.balanceOf(address(this), Currency.wrap(token)), 0);
    }

    function testSellDuringSnipeSplitsWithoutSnipeTax() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 1_000;
        m.initialSnipeTaxBps = 8_800;
        m.hookTaxBps = 100;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 5 ether);
        vm.roll(block.number + 1);

        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        uint256 protoBefore = distributor.pending(Currency.wrap(address(0)));
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        sellExactIn(key, token, bal / 10);

        uint256 creatorDelta = escrow.balanceOf(address(this), Currency.wrap(address(0))) - creatorBefore;
        uint256 protoDelta = distributor.pending(Currency.wrap(address(0))) - protoBefore;
        // Sell fee = base 1% + hook tax 1%. Creator only gets 70% of the base slice; hook tax → protocol
        // (no modules). Creator should still outpace protocol-from-base, but not the old ~85% creator-tax path.
        assertGt(creatorDelta, 0);
        assertGt(protoDelta, creatorDelta); // hook tax remainder tips protocol above creator
    }

    function testAntiSnipeDecays() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 1_000;
        m.initialSnipeTaxBps = 5_000;
        (,,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 1 ether);
        uint256 feesAtLaunch = escrow.balanceOf(address(this), Currency.wrap(address(0)))
            + distributor.pending(Currency.wrap(address(0)));

        vm.warp(block.timestamp + 1_000);
        uint256 pendingBefore = distributor.pending(Currency.wrap(address(0)));
        uint256 escrowBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 1 ether);
        uint256 feesAfterDecay = (escrow.balanceOf(address(this), Currency.wrap(address(0))) - escrowBefore)
            + (distributor.pending(Currency.wrap(address(0))) - pendingBefore);

        assertGt(feesAtLaunch, feesAfterDecay);
    }

    function testAntiMevBlocksOppositeSwapSameBlock() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiMev = true;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        buyExactIn(key, 1 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(bal / 10), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }

    function testAntiMevAllowsOppositeSwapNextBlock() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiMev = true;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        buyExactIn(key, 1 ether);
        vm.roll(block.number + 1);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        sellExactIn(key, token, bal / 10);
    }

    function testMaxTxReverts() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.maxTx = true;
        m.maxTxBps = 1; // 0.01% of supply
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000e18);
        buyExactIn(key, 1 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        uint256 cap = LaunchTokenLike(token).totalSupply() * 1 / 10_000;
        assertGt(bal, cap, "need a fill larger than max tx");
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(bal), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }

    function testGasSnapshotStandardBuy() public {
        (,,, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000_000e18);
        buyExactIn(key, 0.1 ether);
        vm.snapshotGasLastCall("swap_standard_buy");
    }

    function testGasSnapshotAntiSnipeBuy() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 600;
        m.initialSnipeTaxBps = 5_000;
        (,,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        buyExactIn(key, 0.1 ether);
        vm.snapshotGasLastCall("swap_antisnipe_buy");
    }

    function testGasSnapshotFloorFillSell() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 100;
        m.backedFloor = true;
        m.floorAllocationBps = 1_000;
        (, address token,, PoolKey memory key) = launchToken(m, 180_000, 1_000_000e18);
        vault.deposit{value: 50 ether}(token, Currency.wrap(address(0)), 50 ether);
        buyExactIn(key, 0.01 ether);
        vm.roll(block.number + 1);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        sellExactIn(key, token, bal / 2);
        vm.snapshotGasLastCall("swap_floor_fill_sell");
    }
}
