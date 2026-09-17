// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {MultiPairArbExecutor} from "../src/MultiPairArbExecutor.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {HktHolderDropVault} from "../src/HktHolderDropVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";

/// @notice Ink fork: fee split 60/10/30, $HKT holder drops, multi-pair arb, multi-address flows.
contract ForkInkFullCoverageTest is InkForkTestBase {
    using CurrencyLibrary for Currency;

    HktHolderDropVault internal hktDrop;
    MultiPairArbExecutor internal arbExecutor;
    LaunchToken internal hkt;
    address internal hktAlice;
    address internal hktBob;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        hktDrop = new HktHolderDropVault(deployer);
        hkt = new LaunchToken("Hookit", "HKT", 1_000_000e18, deployer, deployer, "", address(hktDrop));
        hktDrop.setHkt(address(hkt));
        hktDrop.setOperator(address(hook), true);
        hktDrop.setOperator(address(graduatedHook), true);
        hktDrop.setOperator(address(bonding), true);
        hook.setHktDropVault(hktDrop);
        graduatedHook.setHktDropVault(hktDrop);
        bonding.setHktDropVault(hktDrop);

        arbExecutor = new MultiPairArbExecutor(manager, factory, hook, deployer);

        hktAlice = makeAddr("hktAlice");
        hktBob = makeAddr("hktBob");
        hkt.transfer(hktAlice, 750_000e18);
        hkt.transfer(hktBob, 250_000e18);
    }

    function testFork_HookFitsEip170() public onlyFork {
        assertLt(address(hook).code.length, 24_576, "MasterLaunchHook must stay under EIP-170");
    }

    function testFork_FeeSplit603010_MultipleAddresses() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Split",
            "SPL"
        );
        Currency quote = Currency.wrap(address(0));

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        uint256 protoBefore = distributor.pending(quote);
        uint256 potBefore = hktDrop.potOf(l.token);
        uint256 buyIn = 5 ether;

        _routerBuy(trader, l.key, l.token, buyIn);
        uint256 expectedBaseFee = buyIn * uint256(ProtocolConstants.BASE_FEE_BPS) / ProtocolConstants.BPS_DENOMINATOR;

        uint256 escrowDelta = escrow.balanceOf(creator, quote) - escrowBefore;
        uint256 protoDelta = distributor.pending(quote) - protoBefore;
        uint256 potDelta = hktDrop.potOf(l.token) - potBefore;

        assertGt(expectedBaseFee, 0);
        assertApproxEqRel(escrowDelta, expectedBaseFee * 60 / 100, 0.06e18, "creator ~60% of base");
        assertApproxEqRel(protoDelta, expectedBaseFee * 30 / 100, 0.08e18, "protocol ~30% of base");
        assertGt(potDelta, 0, "10% of base buys launched token for $HKT holders");

        uint256 aliceBefore = _tokenBalance(l.token, hktAlice);
        uint256 bobBefore = _tokenBalance(l.token, hktBob);
        vm.warp(block.timestamp + hktDrop.epochSeconds());
        assertTrue(hktDrop.tryPush(l.token));
        uint256 aliceGot = _tokenBalance(l.token, hktAlice) - aliceBefore;
        uint256 bobGot = _tokenBalance(l.token, hktBob) - bobBefore;
        assertGt(aliceGot, bobGot, "larger $HKT balance receives more launched token");
        assertApproxEqRel(aliceGot, bobGot * 3, 0.06e18, "75/25 $HKT balances -> 3:1 drop");
    }

    function testFork_HktDropFallbackWhenVaultUnset() public onlyFork {
        hook.setHktDropVault(HktHolderDropVault(address(0)));
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "NoDrop",
            "NDR"
        );
        Currency quote = Currency.wrap(address(0));

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        uint256 protoBefore = distributor.pending(quote);
        _routerBuy(trader, l.key, l.token, 2 ether);

        uint256 escrowDelta = escrow.balanceOf(creator, quote) - escrowBefore;
        uint256 protoDelta = distributor.pending(quote) - protoBefore;
        assertApproxEqRel(escrowDelta, (escrowDelta + protoDelta) * 60 / 100, 0.05e18);
        assertGt(protoDelta, escrowDelta / 2, "10% hkt share falls back to protocol");

        hook.setHktDropVault(hktDrop);
    }

    function testFork_Graduated_Redistributes603010AndHktDrop() public onlyFork {
        BondingResult memory r = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "GradHkt", "GHK");
        _bondingBuyToGraduate(trader, r.launchId, r.quote);
        PoolKey memory key = bonding.poolKeyOf(r.launchId);
        Currency quote = Currency.wrap(address(0));

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        uint256 protoBefore = distributor.pending(quote);

        _routerBuy(trader, key, r.token, 0.2 ether);
        vm.roll(block.number + 1);
        _routerSell(trader, key, r.token, _tokenBalance(r.token, trader) / 4);

        assertGt(distributor.pending(quote), protoBefore, "protocol 30% pushed on swap");
        assertGt(graduatedHook.pendingHktDrop(key.toId(), quote), 0, "10% quote accrues for $HKT buy");

        graduatedHook.sweepHktDrop(key, 1);
        graduatedHook.sweepQuote(key.toId());

        assertGt(escrow.balanceOf(creator, quote), escrowBefore, "creator 60% swept to escrow");
        assertGt(hktDrop.potOf(r.token), 0, "vault holds launched tokens for $HKT holders");
    }

    function testFork_Bonding_HktDropOnCurveFees() public onlyFork {
        BondingResult memory r = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "BondHkt", "BHK");
        uint256 potBefore = hktDrop.potOf(r.token);
        _bondingBuy(trader, r.launchId, r.quote, 1 ether);
        assertGt(hktDrop.potOf(r.token), potBefore, "bonding fees buy tokens for $HKT holders");
    }

    function testFork_MultiPairArb_SkewExecuteThreeAddresses() public onlyFork {
        MockQuoteToken quoteA = new MockQuoteToken("Quote A", "QTA", 18);
        MockQuoteToken quoteB = new MockQuoteToken("Quote B", "QTB", 18);
        factory.setQuote(address(quoteA), true, 18, 2_000e18, address(0));
        factory.setQuote(address(quoteB), true, 18, 3_000e18, address(0));
        deal(address(quoteA), trader, 1_000e18);
        deal(address(quoteB), trader, 1_000e18);

        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteB)), bps: 5_000});

        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 500;
        InkForkTestBase.LaunchResult memory l = _launchMulti(creator, markets, "ArbFork", "ARB");

        PoolKey memory keyA = factory.poolKeyOfMarket(l.launchId, 0);
        PoolKey memory keyB = factory.poolKeyOfMarket(l.launchId, 1);

        _routerBuy(trader, keyB, l.token, 80e18);
        vm.roll(block.number + 1);

        arbExecutor.setPaused(false);
        arbExecutor.setMaxClipUsdX18(500e18);
        arbExecutor.setMinDeviationBps(1_000);
        hook.setArbExecutor(address(arbExecutor));
        hook.setArbActive(true);
        deal(address(quoteA), address(arbExecutor), 100e18);
        deal(address(quoteB), address(arbExecutor), 100e18);

        MultiPairArbExecutor.Preview memory pre = arbExecutor.preview(l.launchId);
        assertTrue(pre.executable, "arb should be executable after skew");
        assertGe(pre.deviationBps, 1_000);

        uint256 protoABefore = distributor.pending(Currency.wrap(address(quoteA)));
        uint256 protoBBefore = distributor.pending(Currency.wrap(address(quoteB)));

        (uint256 clip,,) = arbExecutor.execute(l.launchId);
        assertGt(clip, 0);
        assertGt(distributor.pending(Currency.wrap(address(quoteA))), protoABefore);
        assertGt(distributor.pending(Currency.wrap(address(quoteB))), protoBBefore);

        (,,,,, int24 tickLower, int24 tickUpper,) = factory.launches(l.launchId);
        vm.prank(address(manager));
        vm.expectRevert(MasterLaunchHook.LaunchPositionLocked.selector);
        hook.beforeRemoveLiquidity(
            address(factory),
            keyA,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -1, salt: bytes32(0)}),
            ""
        );
    }

    function testFork_PublicSwapPaysFeesWhileArbArmed() public onlyFork {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: usdg, bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: wspyx, bps: 5_000});
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 300;
        InkForkTestBase.LaunchResult memory l = _launchMulti(creator, markets, "Armed", "ARM");

        arbExecutor.setPaused(false);
        arbExecutor.setMaxClipUsdX18(100e18);
        hook.setArbExecutor(address(arbExecutor));
        hook.setArbActive(true);

        uint256 escrowBefore = escrow.balanceOf(creator, usdg);
        uint256 protoBefore = distributor.pending(usdg);
        _routerBuy(trader, factory.poolKeyOfMarket(l.launchId, 0), l.token, 500e6);
        assertGt(escrow.balanceOf(creator, usdg), escrowBefore);
        assertGt(distributor.pending(usdg), protoBefore);
    }

    function testFork_ThreeCreators_IsolatedFeeEscrows() public onlyFork {
        address creatorB = makeAddr("creatorB");
        address creatorC = makeAddr("creatorC");
        vm.deal(creatorB, 10 ether);
        vm.deal(creatorC, 10 ether);

        InkForkTestBase.LaunchResult memory a = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "A",
            "AAA"
        );
        InkForkTestBase.LaunchResult memory b =
            _launch(creatorB, usdg, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "B", "BBB");
        InkForkTestBase.LaunchResult memory c =
            _launch(creatorC, wspyx, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "C", "CCC");

        _routerBuy(trader, a.key, a.token, 1 ether);
        _routerBuy(trader, b.key, b.token, 300e6);
        _routerBuy(trader, c.key, c.token, 0.05e18);

        assertGt(escrow.balanceOf(creator, Currency.wrap(address(0))), 0);
        assertGt(escrow.balanceOf(creatorB, usdg), 0);
        assertGt(escrow.balanceOf(creatorC, wspyx), 0);

        uint256 balA = creator.balance;
        _claimCreatorFees(creator, Currency.wrap(address(0)));
        assertGt(creator.balance, balA);

        uint256 usdgB = IERC20(Currency.unwrap(usdg)).balanceOf(creatorB);
        _claimCreatorFees(creatorB, usdg);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(creatorB), usdgB);
    }

    function testFork_HookTaxSeparateFromBaseSplit() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 400;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Tax", "TAX");

        Currency quote = Currency.wrap(address(0));
        uint256 buyIn = 4 ether;
        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        uint256 protoBefore = distributor.pending(quote);
        uint256 potBefore = hktDrop.potOf(l.token);

        _routerBuy(trader, l.key, l.token, buyIn);

        uint256 escrowDelta = escrow.balanceOf(creator, quote) - escrowBefore;
        uint256 protoDelta = distributor.pending(quote) - protoBefore;
        uint256 potDelta = hktDrop.potOf(l.token) - potBefore;
        uint256 expectedBaseFee = buyIn * uint256(ProtocolConstants.BASE_FEE_BPS) / ProtocolConstants.BPS_DENOMINATOR;

        uint256 expectedHookTax = buyIn * 400 / ProtocolConstants.BPS_DENOMINATOR;
        assertApproxEqRel(escrowDelta, expectedBaseFee * 60 / 100 + expectedHookTax, 0.08e18, "creator base + hook tax");
        assertGt(potDelta, 0, "hkt holder cut buys launched token");
        assertApproxEqRel(protoDelta, expectedBaseFee * 30 / 100, 0.08e18, "protocol 30% of base only");
        assertGt(escrowDelta, protoDelta, "unrouted hook tax pays the creator");
    }
}
