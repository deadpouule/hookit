// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BondingConstants} from "../src/libraries/BondingConstants.sol";

/// @notice Ink fork: Classic bonding → graduate → v4 swap → sweep across quotes.
contract ForkInkBondingTest is InkForkTestBase {
    using CurrencyLibrary for Currency;

    function testFork_Bonding_GraduationTargetEth() public onlyFork {
        assertEq(bonding.graduationQuoteWei(Currency.wrap(address(0))), 4.2 ether);
    }

    function testFork_Bonding_GraduationTargetUsdg() public onlyFork {
        uint256 target = bonding.graduationQuoteWei(usdg);
        // ETH @$4k → 4.2 ETH = $16,800 → 16800e6 USDG
        assertEq(target, 16_800e6);
    }

    function testFork_Bonding_GraduationTargetWspyx() public onlyFork {
        uint256 liveUsd = bonding.quoteUsdPriceX18(Currency.unwrap(wspyx));
        assertGt(liveUsd, 0);
        // Must come from Quotrons pool sqrtPrice, not the hardcoded bootstrap alone.
        (, uint8 dec, uint256 snapshot,) = bonding.quoteConfigs(Currency.unwrap(wspyx));
        assertEq(dec, 18);
        // Live and snapshot can differ; both should be in a sane equity band.
        assertGt(liveUsd, 100e18);
        assertLt(liveUsd, 5_000e18);
        if (snapshot != 0) {
            // Allow wide arb band vs bootstrap (markets move).
            assertApproxEqRel(liveUsd, snapshot, 0.5e18);
        }

        uint256 target = bonding.graduationQuoteWei(wspyx);
        assertGt(target, 0);
        assertLt(target, 100e18);
    }

    function testFork_Bonding_Eth_BuySellGraduateSwapSweep() public onlyFork {
        _fullClassicLifecycle(Currency.wrap(address(0)), 0);
    }

    function testFork_Bonding_Usdg_BuyGraduateSwapSweep() public onlyFork {
        _fullClassicLifecycle(usdg, 0);
    }

    function testFork_Bonding_Wspyx_BuyGraduateSwapSweep() public onlyFork {
        _fullClassicLifecycle(wspyx, 0);
    }

    function testFork_Bonding_Eth_CreatorTaxDisabled() public onlyFork {
        vm.prank(creator);
        vm.expectRevert(BondingLaunchFactory.CreatorTaxTooHigh.selector);
        bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Tax",
                symbol: "TAX",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 200,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testFork_Bonding_Usdg_CreatorTaxDisabled() public onlyFork {
        vm.prank(creator);
        vm.expectRevert(BondingLaunchFactory.CreatorTaxTooHigh.selector);
        bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "TaxU",
                symbol: "TXU",
                metadataURI: "",
                totalSupply: 0,
                quote: usdg,
                creatorTaxBps: 1,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testFork_Bonding_SellBeforeGraduate() public onlyFork {
        BondingResult memory r = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "Pre", "PRE");
        _bondingBuy(trader, r.launchId, r.quote, 0.5 ether);
        assertEq(uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Bonding));

        uint256 bal = _tokenBalance(r.token, trader);
        vm.startPrank(trader);
        IERC20(r.token).approve(address(bonding), bal / 2);
        (uint256 quoteOut,) = bonding.sell(r.launchId, bal / 2, 1);
        vm.stopPrank();
        assertGt(quoteOut, 0);
        assertEq(uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Bonding));
    }

    function testFork_Bonding_FeeCapReverts() public onlyFork {
        vm.prank(creator);
        vm.expectRevert(BondingLaunchFactory.CreatorTaxTooHigh.selector);
        bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Bad",
                symbol: "BAD",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 1,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testFork_Bonding_PermissionlessGraduate() public onlyFork {
        BondingResult memory r = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "Grad", "GRD");
        // Buy just under threshold (net), then nudge over and call graduate().
        uint256 almost = r.graduationQuote - 0.05 ether;
        uint256 grossAlmost = almost + almost / 50;
        _bondingBuy(trader, r.launchId, r.quote, grossAlmost);
        if (_bondingPhase(r.launchId) == BondingLaunchFactory.Phase.Graduated) {
            // Auto-graduated on the buy — still OK.
            return;
        }
        _bondingBuy(trader, r.launchId, r.quote, 0.2 ether);
        if (_bondingPhase(r.launchId) == BondingLaunchFactory.Phase.Bonding) {
            bonding.graduate(r.launchId);
        }
        assertEq(uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Graduated));
    }

    function testFork_Bonding_PostGrad_AnyRouterCanSwap() public onlyFork {
        BondingResult memory r = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "Rtr", "RTR");
        _bondingBuyToGraduate(trader, r.launchId, r.quote);
        assertEq(uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory key = bonding.poolKeyOf(r.launchId);
        assertEq(key.fee, BondingConstants.POOL_FEE);
        assertEq(address(key.hooks), address(graduatedHook));

        // Vanilla HookitSwapRouter — no bonding-specific integration.
        _routerBuy(trader, key, r.token, 0.05 ether);
        assertGt(_tokenBalance(r.token, trader), 0);
    }

    function _fullClassicLifecycle(Currency quote, uint16 creatorTaxBps) internal {
        BondingResult memory r = _bondingLaunch(creator, quote, creatorTaxBps, "Classic", "CLS");
        assertEq(r.graduationQuote, bonding.graduationQuoteWei(quote));
        assertEq(IERC20(r.token).balanceOf(address(bonding)), BondingConstants.TOTAL_SUPPLY);

        _bondingBuyToGraduate(trader, r.launchId, quote);
        assertEq(uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory key = bonding.poolKeyOf(r.launchId);
        PoolId poolId = key.toId();

        uint256 buyIn = quote.isAddressZero() ? 0.05 ether : (quote == usdg ? 200e6 : 0.02e18);
        _routerBuy(trader, key, r.token, buyIn);
        uint256 tokBal = _tokenBalance(r.token, trader);
        assertGt(tokBal, 0);

        vm.roll(block.number + 1);
        _routerSell(trader, key, r.token, tokBal / 5);

        uint256 pendingQuote = graduatedHook.pendingFees(poolId, quote)
            + graduatedHook.pendingCreatorTax(poolId, quote);
        uint256 pendingTok = graduatedHook.pendingFees(poolId, Currency.wrap(r.token))
            + graduatedHook.pendingCreatorTax(poolId, Currency.wrap(r.token));
        assertGt(pendingQuote + pendingTok, 0);

        if (pendingQuote > 0) {
            uint256 creatorBefore = escrow.balanceOf(creator, quote);
            graduatedHook.sweepQuote(poolId);
            assertGt(escrow.balanceOf(creator, quote), creatorBefore);
        } else {
            graduatedHook.sweepWithConversion(key, 1);
            assertGt(
                escrow.balanceOf(creator, quote) + distributor.pending(quote),
                0
            );
        }
    }
}
