// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {HookitCustomHook} from "../src/examples/HookitCustomHook.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";

/// @notice Fills remaining coverage gaps: floor sell, buyback vesting claim, custom hook.
contract CompletenessTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    address internal trader = address(0xBEEF);

    function setUp() public {
        deployProtocol();
        vm.deal(trader, 200 ether);
    }

    // ─── Floor sell (vault intercept) ─────────────────────────────────────────

    function testFloorFillSell_QuoteDrawnFromVault() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.floorAllocationBps = 1_000;
        (uint256 launchId, address token, PoolId poolId, PoolKey memory key) =
            launchToken(m, 0, 1_000_000e18);
        key = factory.poolKeyOf(launchId);

        vault.deposit{value: 40 ether}(token, Currency.wrap(address(0)), 40 ether);
        uint256 reserveBefore = vault.reserve(token);

        _buyAs(trader, key, 0.05 ether);
        vm.roll(block.number + 1);

        uint256 bal = LaunchTokenLike(token).balanceOf(trader);
        uint256 ethBefore = trader.balance;
        _sellAs(trader, key, token, bal / 2);

        assertGt(trader.balance, ethBefore);
        assertLt(vault.reserve(token), reserveBefore);
        poolId;
    }

    function testRedeemFloor_DirectBurnPath() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.backedFloor = true;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000e18);
        key = factory.poolKeyOf(launchId);

        vault.deposit{value: 10 ether}(token, Currency.wrap(address(0)), 10 ether);
        _buyAs(trader, key, 0.1 ether);

        uint256 amount = LaunchTokenLike(token).balanceOf(trader) / 4;
        uint256 ethBefore = trader.balance;
        vm.startPrank(trader);
        LaunchTokenLike(token).approve(address(vault), amount);
        vault.redeemFloor(token, amount);
        vm.stopPrank();

        assertGt(trader.balance, ethBefore);
        assertLt(IERC20Supply(token).totalSupply(), 1_000_000e18);
    }

    // ─── Buyback vesting: full 5-year claim ───────────────────────────────────

    function testBuyback_FullFiveYearVestAndClaim() public {
        address token = address(0xBEEF1234);
        uint256 amount = 8 ether;
        buybacks.credit{value: amount}(
            address(this), token, Currency.wrap(address(0)), amount, uint64(ProtocolConstants.BUYBACK_VESTING_DURATION)
        );

        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION + 1 days);
        assertEq(buybacks.vestedOf(address(this), token), amount);

        uint256 balBefore = address(this).balance;
        buybacks.claim(token);
        assertEq(address(this).balance - balBefore, amount);
        assertEq(buybacks.vestedOf(address(this), token), 0);
    }

    function testBuyback_IncrementalClaimsOverVest() public {
        address token = address(0xBEEF5678);
        uint256 amount = 10 ether;
        buybacks.credit{value: amount}(
            address(this), token, Currency.wrap(address(0)), amount, uint64(ProtocolConstants.BUYBACK_VESTING_DURATION)
        );

        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION / 2);
        buybacks.claim(token);
        uint256 half = amount / 2;

        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION / 2 + 1);
        uint256 before = address(this).balance;
        buybacks.claim(token);
        assertApproxEqRel(address(this).balance - before, amount - half, 0.01e18);
    }

    function testBuybackVesting_EndToEndFromLaunch() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.buybackVesting = true;
        m.hookTaxBps = 300;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        key = factory.poolKeyOf(launchId);

        _buyAs(trader, key, 3 ether);
        (, uint128 streamed,,,) = buybacks.streams(address(this), token);
        assertGt(streamed, 0);

        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION + 1);
        uint256 before = address(this).balance;
        buybacks.claim(token);
        assertGt(address(this).balance, before);
    }

    function testBuybackVesting_CustomDurationFromLaunch() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.buybackVesting = true;
        m.buybackVestingDurationSeconds = 30 days;
        m.hookTaxBps = 200;
        (uint256 launchId, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        key = factory.poolKeyOf(launchId);

        _buyAs(trader, key, 2 ether);
        (,,,, uint64 duration) = buybacks.streams(address(this), token);
        assertEq(duration, 30 days);

        vm.warp(block.timestamp + 15 days);
        assertGt(buybacks.vestedOf(address(this), token), 0);
        vm.warp(block.timestamp + 16 days);
        (, uint128 amount,,,) = buybacks.streams(address(this), token);
        assertEq(buybacks.vestedOf(address(this), token), amount);
    }

    // ─── Custom hook launch ───────────────────────────────────────────────────

    function testCustomHook_LaunchBuySwap() public {
        address flags = address(
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG) | (uint160(0xC057) << 144)
        );
        deployCodeTo("HookitCustomHook.sol:HookitCustomHook", abi.encode(manager), flags);
        HookitCustomHook customHook = HookitCustomHook(payable(flags));

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(customHook))
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);
        (,, IHooks hooks, bool isCustom,,,,) = factory.launches(launchId);
        assertTrue(isCustom);
        assertEq(address(hooks), address(customHook));

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 mcap = FixedPointMath.quoteFromToken(ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, sqrtPriceX96, false);
        assertApproxEqRel(mcap, factory.launchMcapQuoteWei(), 0.02e18);

        _buyAs(trader, key, 0.1 ether);
        assertGt(LaunchTokenLike(token).balanceOf(trader), 0);
    }

    // ─── Kitchen sink on alternate quote path (mock USDC) ─────────────────────

    function testKitchenSink_MockUsdcQuote() public {
        MockQuoteToken usdc = new MockQuoteToken("USD", "USD", 6);
        factory.setQuote(address(usdc), true, 6, 1e18, address(0));

        BitmaskConfig.Modules memory m = ModuleMatrix.kitchenSink();
        uint256 bitmask = BitmaskConfig.pack(m);

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "KS",
                symbol: "KS",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(usdc)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0))
            })
        );

        PoolKey memory key = factory.poolKeyOf(launchId);
        assertEq(factory.launchBitmasks(launchId), bitmask);

        deal(address(usdc), trader, 1_000_000e6);
        vm.startPrank(trader);
        usdc.approve(address(swapRouter), type(uint256).max);
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(500e6), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(trader)
        );
        vm.stopPrank();

        assertGt(LaunchTokenLike(token).balanceOf(trader), 0);
        assertGt(vault.reserve(token), 0);
        poolId;
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
}

import {IERC20Supply} from "../src/FloorVault.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";
