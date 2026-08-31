// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {HookitCustomHook} from "../src/examples/HookitCustomHook.sol";

/// @notice Ink fork gap coverage: floor sell, buyback claim, kitchen sink × quotes, custom hook.
contract ForkInkCompletenessTest is InkForkTestBase {
    using StateLibrary for IPoolManager;

    HookitCustomHook internal customHook;

    // ─── Floor sell via vault intercept ───────────────────────────────────────

    function testFork_FloorFillSell_DrawsVault() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.floorAllocationBps = 1_500;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, 1_000_000e18, "Floor", "FLR");

        vault.deposit{value: 30 ether}(l.token, Currency.wrap(address(0)), 30 ether);
        uint256 reserveBefore = vault.reserve(l.token);

        _routerBuy(trader, l.key, l.token, 0.1 ether);
        vm.roll(block.number + 1);

        uint256 ethBefore = trader.balance;
        uint256 tokens = _tokenBalance(l.token, trader);
        _routerSell(trader, l.key, l.token, tokens / 2);

        assertGt(trader.balance, ethBefore);
        assertLt(vault.reserve(l.token), reserveBefore);
    }

    function testFork_RedeemFloor_Direct() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.backedFloor = true;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, 1_000_000e18, "Redeem", "RDM");

        vault.deposit{value: 15 ether}(l.token, Currency.wrap(address(0)), 15 ether);
        _routerBuy(trader, l.key, l.token, 0.2 ether);

        uint256 amount = _tokenBalance(l.token, trader) / 5;
        uint256 ethBefore = trader.balance;
        vm.startPrank(trader);
        IERC20(l.token).approve(address(vault), amount);
        vault.redeemFloor(l.token, amount);
        vm.stopPrank();

        assertGt(trader.balance, ethBefore);
    }

    // ─── Buyback vesting: full claim after 5 years ────────────────────────────

    function testFork_Buyback_FullVestClaim() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.buybackVesting = true;
        m.hookTaxBps = 200;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "BB", "BB");

        _routerBuy(trader, l.key, l.token, 4 ether);
        (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
        assertGt(streamed, 0);

        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION + 1 days);
        assertEq(buybacks.vestedOf(creator, l.token), streamed);

        uint256 ethBefore = creator.balance;
        vm.prank(creator);
        buybacks.claim(l.token);
        assertGt(creator.balance, ethBefore);
    }

    // ─── Kitchen sink × all quote assets ──────────────────────────────────────

    function testFork_KitchenSink_EthQuote() public onlyFork {
        _kitchenSinkSmoke(Currency.wrap(address(0)));
    }

    function testFork_KitchenSink_UsdgQuote() public onlyFork {
        _kitchenSinkSmoke(usdg);
    }

    function testFork_KitchenSink_SpyxQuote() public onlyFork {
        _kitchenSinkSmoke(wspyx);
    }

    // ─── Creator claim fees on non-ETH quotes ─────────────────────────────────

    function testFork_CreatorClaimFees_SpyxQuote() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 100;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, wspyx, m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "SpyFee", "SFE");

        _routerBuy(trader, l.key, l.token, 0.05e18);
        uint256 wspyxBefore = IERC20(Currency.unwrap(wspyx)).balanceOf(creator);
        _claimCreatorFees(creator, wspyx);
        assertGt(IERC20(Currency.unwrap(wspyx)).balanceOf(creator), wspyxBefore);
    }

    // ─── Custom hook on Ink fork ──────────────────────────────────────────────

    function testFork_CustomHook_LaunchAndBuy() public onlyFork {
        address flags =
            address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG) | (uint160(0xC057) << 144));
        deployCodeTo("HookitCustomHook.sol:HookitCustomHook", abi.encode(manager), flags);
        customHook = HookitCustomHook(payable(flags));

        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom",
                symbol: "CST",
                metadataURI: "ipfs://ink-custom",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(customHook)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );

        InkForkTestBase.LaunchResult memory l;
        l.launchId = launchId;
        l.token = token;
        l.poolId = poolId;
        l.key = factory.poolKeyOf(launchId);
        l.launcher = creator;

        (,, IHooks hooks, bool isCustom,,,,) = factory.launches(launchId);
        assertTrue(isCustom);
        assertEq(address(hooks), address(customHook));

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(poolId);
        uint256 mcap = FixedPointMath.quoteFromToken(ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, sqrtPriceX96, false);
        assertApproxEqRel(mcap, factory.launchMcapQuoteWei(), 0.03e18);

        _routerBuy(trader, l.key, l.token, 0.15 ether);
        assertGt(_tokenBalance(l.token, trader), 0);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _kitchenSinkSmoke(Currency quote) internal {
        BitmaskConfig.Modules memory m = ModuleMatrix.kitchenSink();
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, quote, m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "KS", "KS");

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(l.poolId);

        if (quote.isAddressZero()) {
            _routerBuy(trader, l.key, l.token, 0.25 ether);
        } else if (quote == usdg) {
            _routerBuy(trader, l.key, l.token, 1_000e6);
        } else {
            _routerBuy(trader, l.key, l.token, 0.05e18);
        }
        assertGt(_tokenBalance(l.token, trader), 0);

        assertGt(vault.reserve(l.token), 0);
        (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
        assertGt(streamed, 0);
        assertLt(IERC20(l.token).totalSupply(), supplyBefore);
        (uint256 g0After, uint256 g1After) = manager.getFeeGrowthGlobals(l.poolId);
        assertTrue(g0After > g0Before || g1After > g1Before);

        vm.roll(block.number + 1);
        _routerSell(trader, l.key, l.token, _tokenBalance(l.token, trader) / 10);
    }
}

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
