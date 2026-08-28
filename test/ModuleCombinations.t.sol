// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";

/// @notice Exhaustive and behavioral tests for all launch module combinations.
contract ModuleCombinationsTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    address internal buyer = address(0xBEEF);

    function setUp() public {
        deployProtocol();
        vm.deal(buyer, 100 ether);
    }

    // ─── Exhaustive 512 masks (8 × 64 batches) ───────────────────────────────

    function testAllModuleMasks_Batch0() public { _runMaskBatch(0, 64); }
    function testAllModuleMasks_Batch1() public { _runMaskBatch(64, 64); }
    function testAllModuleMasks_Batch2() public { _runMaskBatch(128, 64); }
    function testAllModuleMasks_Batch3() public { _runMaskBatch(192, 64); }
    function testAllModuleMasks_Batch4() public { _runMaskBatch(256, 64); }
    function testAllModuleMasks_Batch5() public { _runMaskBatch(320, 64); }
    function testAllModuleMasks_Batch6() public { _runMaskBatch(384, 64); }
    function testAllModuleMasks_Batch7() public { _runMaskBatch(448, 64); }

    function _runMaskBatch(uint16 start, uint16 count) internal {
        for (uint16 i; i < count; ++i) {
            _launchBuySellSmoke(start + i);
        }
    }

    function _launchBuySellSmoke(uint16 mask) internal {
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(mask);
        uint256 packed = BitmaskConfig.pack(m);

        (uint256 launchId, address token, PoolId poolId,) =
            launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        PoolKey memory key = factory.poolKeyOf(launchId);

        assertGt(launchId, 0);
        assertGt(uint160(token), 0);
        assertTrue(PoolId.unwrap(poolId) != bytes32(0));
        assertEq(factory.launchBitmasks(launchId), packed);

        if (m.dynamicFees) {
            assertTrue(key.fee & LPFeeLibrary.DYNAMIC_FEE_FLAG != 0);
        }

        _buyAs(buyer, key, 0.05 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(buyer);
        assertGt(bal, 0);

        _assertModuleSideEffects(token, poolId, m);

        if (!m.antiMev) {
            vm.roll(block.number + 1);
            _sellAs(buyer, key, token, bal / 10);
        }
    }

    function _buyAs(address user, PoolKey memory key, uint256 ethIn) internal {
        vm.prank(user);
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
    }

    function _sellAs(address user, PoolKey memory key, address token, uint256 tokenIn) internal {
        vm.startPrank(user);
        LaunchTokenLike(token).approve(address(swapRouter), tokenIn);
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(tokenIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
        vm.stopPrank();
    }

    function _assertModuleSideEffects(address token, PoolId poolId, BitmaskConfig.Modules memory m) internal {
        if (m.backedFloor) assertGt(vault.reserve(token), 0);
        if (m.buybackVesting) {
            (uint128 streamed,,) = buybacks.streams(address(this), Currency.wrap(address(0)));
            assertGt(streamed, 0);
            assertEq(escrow.balanceOf(address(this), Currency.wrap(address(0))), 0);
        }
        if (m.autoBurn) assertEq(hook.pendingAutoBurn(poolId), 0);
        if (m.lpDonate) assertEq(hook.pendingLpDonate(poolId), 0);
    }

    // ─── Kitchen sink & singles ───────────────────────────────────────────────

    function testKitchenSink_AllModulesEnabled() public {
        _launchBuySellSmoke(uint16(ModuleMatrix.MASK_SPACE - 1));
    }

    function testSingleModule_AntiSnipe() public { _launchBuySellSmoke(ModuleMatrix.BIT_ANTI_SNIPE); }
    function testSingleModule_BackedFloor() public { _launchBuySellSmoke(ModuleMatrix.BIT_BACKED_FLOOR); }
    function testSingleModule_AntiMev() public { _launchBuySellSmoke(ModuleMatrix.BIT_ANTI_MEV); }
    function testSingleModule_MaxTx() public { _launchBuySellSmoke(ModuleMatrix.BIT_MAX_TX); }
    function testSingleModule_MaxWallet() public { _launchBuySellSmoke(ModuleMatrix.BIT_MAX_WALLET); }
    function testSingleModule_DynamicFees() public { _launchBuySellSmoke(ModuleMatrix.BIT_DYNAMIC_FEES); }
    function testSingleModule_BuybackVesting() public { _launchBuySellSmoke(ModuleMatrix.BIT_BUYBACK_VESTING); }
    function testSingleModule_AutoBurn() public { _launchBuySellSmoke(ModuleMatrix.BIT_AUTO_BURN); }
    function testSingleModule_LpDonate() public { _launchBuySellSmoke(ModuleMatrix.BIT_LP_DONATE); }

    // ─── Behavioral edge cases ────────────────────────────────────────────────

    function testMaxWallet_RevertsWhenBalanceExceedsCap() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.maxWallet = true;
        m.maxWalletBps = 5; // 0.05%
        (uint256 launchId,,, PoolKey memory key) = launchToken(m, 0, 1_000_000e18);
        key = factory.poolKeyOf(launchId);

        _buyAs(buyer, key, 10 ether);
        vm.expectRevert();
        _buyAs(buyer, key, 1 ether);
    }

    function testMaxTx_RevertsAboveCap() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.maxTx = true;
        m.maxTxBps = 1;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, 1_000e18);
        key = factory.poolKeyOf(launchId);

        _buyAs(buyer, key, 1 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(buyer);
        uint256 cap = (1_000e18 * 1) / 10_000;
        assertGt(bal, cap);

        vm.startPrank(buyer);
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(bal), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(buyer)
        );
        vm.stopPrank();
    }

    function testBuybackVesting_SkipsEscrow() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.buybackVesting = true;
        m.hookTaxBps = 200;
        (uint256 launchId,,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        key = factory.poolKeyOf(launchId);

        _buyAs(buyer, key, 2 ether);
        (uint128 streamed,,) = buybacks.streams(address(this), Currency.wrap(address(0)));
        assertGt(streamed, 0);
        assertEq(escrow.balanceOf(address(this), Currency.wrap(address(0))), 0);
    }

    function testFeeRoutingTriple_FloorBurnDonate() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 300;
        m.backedFloor = true;
        m.autoBurn = true;
        m.lpDonate = true;
        m.floorAllocationBps = 1_500;
        m.autoBurnBps = 1_500;
        m.lpDonateBps = 1_500;
        (uint256 launchId, address token, PoolId poolId,) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        PoolKey memory key = factory.poolKeyOf(launchId);

        uint256 supplyBefore = LaunchTokenLike(token).totalSupply();
        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(poolId);

        _buyAs(buyer, key, 1 ether);

        assertGt(vault.reserve(token), 0);
        assertLt(LaunchTokenLike(token).totalSupply(), supplyBefore);
        (uint256 g0After, uint256 g1After) = manager.getFeeGrowthGlobals(poolId);
        assertTrue(g0After > g0Before || g1After > g1Before);
    }

    function testAntiMevPlusAntiSnipe_BuyOnlySameBlock() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiMev = true;
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 500;
        m.initialSnipeTaxBps = 2_000;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        key = factory.poolKeyOf(launchId);

        _buyAs(buyer, key, 0.5 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(buyer);

        vm.startPrank(buyer);
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(bal / 20), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(buyer)
        );
        vm.stopPrank();
    }

    function testFuzz_ModuleMask_AlwaysPackable(uint16 mask) public {
        mask = uint16(mask & (ModuleMatrix.MASK_SPACE - 1));
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(mask);
        assertLe(ModuleMatrix.maxOpenFeeBps(m), ProtocolConstants.BPS_DENOMINATOR);
        BitmaskConfig.Modules memory out = BitmaskConfig.unpack(BitmaskConfig.pack(m));
        assertEq(out.antiSnipe, m.antiSnipe);
        assertEq(out.lpDonate, m.lpDonate);
    }
}
