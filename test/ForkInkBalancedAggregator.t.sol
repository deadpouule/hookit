// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BalancedAggregator} from "../src/BalancedAggregator.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";

/// @notice Ink-mainnet fork coverage for BalancedAggregator: sizes, splits, hook modules, isolation.
contract ForkInkBalancedAggregatorTest is InkForkTestBase {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    BalancedAggregator internal aggregator;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;
        aggregator = new BalancedAggregator(manager, factory);
    }

    // ─── Baseline round-trip ──────────────────────────────────────────────────

    function testFork_BalancedAggregator_SplitBuyAndSell() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        _buySplit(launchId, token, _twoWay(60e6, 40e6));
        vm.roll(block.number + 1);
        uint256 sellAmt = IERC20(token).balanceOf(trader) / 3;
        _sellOne(launchId, token, 0, sellAmt);
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_BuySlippageRevertsAtomically() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        Currency stock = _quoteCurrency(hookKey, token);
        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(stock));
        uint256 legIn = 50e6;

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), type(uint256).max);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), type(uint256).max);
        uint256 expected = router.swapExactInComposite(
            bridgeKey,
            QuotronBridge.zeroForOne(Currency.unwrap(stock), Currency.unwrap(usdg)),
            legIn,
            hookKey,
            _buyZeroForOne(hookKey, token),
            stock,
            1,
            0,
            0
        );

        BalancedAggregator.RouteLeg[] memory legs = new BalancedAggregator.RouteLeg[](1);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: legIn, minAmountOut: expected + 1});

        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 tokenBefore = IERC20(token).balanceOf(trader);
        (uint160 hookBefore,,,) = manager.getSlot0(hookKey.toId());

        vm.expectRevert(BalancedAggregator.InsufficientOutput.selector);
        aggregator.buyExactInput(launchId, token, legIn, 1, legs, trader, block.timestamp + 600);

        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore, "revert spent USDG");
        assertEq(IERC20(token).balanceOf(trader), tokenBefore, "revert delivered token");
        (uint160 hookAfter,,,) = manager.getSlot0(hookKey.toId());
        assertEq(hookAfter, hookBefore, "revert moved pool");
        vm.stopPrank();
    }

    // ─── Sizes ────────────────────────────────────────────────────────────────

    function testFork_BalancedAggregator_SizeSweep() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());

        uint256[5] memory sizes = [uint256(1e6), 10e6, 50e6, 100e6, 250e6];
        for (uint256 i; i < sizes.length; ++i) {
            vm.roll(block.number + 1);
            uint256 half = sizes[i] / 2;
            BalancedAggregator.RouteLeg[] memory legs = _twoWay(half, sizes[i] - half);
            uint256 before = IERC20(token).balanceOf(trader);
            uint256 bought = _tryBuy(launchId, token, legs);
            if (sizes[i] <= 100e6) {
                assertGt(bought, 0, "retail/mid size must fill");
                assertEq(IERC20(token).balanceOf(trader), before + bought, "buy credit");
            } else if (bought == 0) {
                // 250 USDG may hit the 15% sqrt impact cap on a thin Quotrons hop.
                continue;
            }
            _assertAggregatorEmpty(token);
        }
    }

    function testFork_BalancedAggregator_DustAndUnevenSplits() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 1, 2, _defaultModules());

        uint256 bought = _buySplit(launchId, token, _twoWay(90e6, 10e6));
        assertGt(bought, 0, "90/10");
        vm.roll(block.number + 1);
        bought = _buySplit(launchId, token, _twoWay(1, 1e6 - 1));
        assertGt(bought, 0, "dust + 1 USDG");
        _assertAggregatorEmpty(token);
    }

    // ─── Market shapes ────────────────────────────────────────────────────────

    function testFork_BalancedAggregator_ThreeAndFiveWaySplits() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 3, _defaultModules());
        BalancedAggregator.RouteLeg[] memory three = new BalancedAggregator.RouteLeg[](3);
        three[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 20e6, minAmountOut: 1});
        three[1] = BalancedAggregator.RouteLeg({marketIndex: 1, amountIn: 20e6, minAmountOut: 1});
        three[2] = BalancedAggregator.RouteLeg({marketIndex: 2, amountIn: 20e6, minAmountOut: 1});
        assertGt(_buySplit(launchId, token, three), 0, "3-way");

        (uint256 id5, address tok5) = _launchStockGroup(stocks, 4, 5, _defaultModules());
        BalancedAggregator.RouteLeg[] memory five = new BalancedAggregator.RouteLeg[](5);
        for (uint256 i; i < 5; ++i) {
            five[i] = BalancedAggregator.RouteLeg({marketIndex: uint8(i), amountIn: 8e6, minAmountOut: 1});
        }
        assertGt(_buySplit(id5, tok5, five), 0, "5-way");
        _assertAggregatorEmpty(tok5);
    }

    function testFork_BalancedAggregator_UsdgPlusStock_Split() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        Currency[] memory quotes = new Currency[](2);
        quotes[0] = usdg;
        quotes[1] = Currency.wrap(stocks[0].token);
        (uint256 launchId, address token) = _launchQuotes(quotes, _defaultModules());

        uint256 bought = _buySplit(launchId, token, _twoWay(40e6, 60e6));
        assertGt(bought, 0, "direct USDG + Quotrons composite");

        PoolKey memory usdgKey = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory stockKey = factory.poolKeyOfMarket(launchId, 1);
        assertEq(Currency.unwrap(_quoteCurrency(usdgKey, token)), Currency.unwrap(usdg), "market 0 is USDG");
        assertTrue(QuotronBridge.isQuotronStock(Currency.unwrap(_quoteCurrency(stockKey, token))), "market 1 stock");
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_IdleMarketUnmoved() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 3, _defaultModules());
        PoolKey memory idle1 = factory.poolKeyOfMarket(launchId, 1);
        PoolKey memory idle2 = factory.poolKeyOfMarket(launchId, 2);
        (uint160 p1,,,) = manager.getSlot0(idle1.toId());
        (uint160 p2,,,) = manager.getSlot0(idle2.toId());

        BalancedAggregator.RouteLeg[] memory legs = new BalancedAggregator.RouteLeg[](1);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 25e6, minAmountOut: 1});
        _buySplit(launchId, token, legs);

        (uint160 a1,,,) = manager.getSlot0(idle1.toId());
        (uint160 a2,,,) = manager.getSlot0(idle2.toId());
        assertEq(a1, p1, "idle market 1 moved");
        assertEq(a2, p2, "idle market 2 moved");
    }

    // ─── Hooks ────────────────────────────────────────────────────────────────

    function testFork_BalancedAggregator_HookTaxAndAirdrop_IsolatedPots() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        m.hookTaxBps = 200;

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 2, 2, m);
        PoolKey memory traded = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory idle = factory.poolKeyOfMarket(launchId, 1);
        Currency tradedQuote = _quoteCurrency(traded, token);
        Currency idleQuote = _quoteCurrency(idle, token);

        BalancedAggregator.RouteLeg[] memory legs = new BalancedAggregator.RouteLeg[](1);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 80e6, minAmountOut: 1});
        assertGt(_buySplit(launchId, token, legs), 0);

        assertGt(airdrops.potOf(token, tradedQuote), 0, "traded quote pot empty");
        assertEq(airdrops.potOf(token, idleQuote), 0, "idle quote received fees");
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_BurnDeepenAirdrop() public onlyFork {
        BitmaskConfig.Modules memory m = ModuleMatrix.fromMask(
            ModuleMatrix.BIT_AUTO_BURN | ModuleMatrix.BIT_DEEPEN_LPS | ModuleMatrix.BIT_HOLDER_AIRDROP
        );
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, m);
        PoolKey memory key0 = factory.poolKeyOfMarket(launchId, 0);
        uint256 supplyBefore = IERC20(token).totalSupply();
        uint128 seedLiq = hook.launchState(key0.toId()).seedLiquidity;

        uint256 bought = _buySplit(launchId, token, _twoWay(50e6, 50e6));
        assertGt(bought, 0);

        assertTrue(
            IERC20(token).totalSupply() < supplyBefore || hook.pendingAutoBurn(key0.toId()) > 0, "burn idle"
        );
        assertTrue(
            manager.getLiquidity(key0.toId()) > seedLiq || hook.pendingDeepenLps(key0.toId()) > 0, "deepen idle"
        );
        assertGt(airdrops.potOf(token, _quoteCurrency(key0, token)), 0, "airdrop pot");
    }

    function testFork_BalancedAggregator_DynamicFeesAndAntiSnipe() public onlyFork {
        BitmaskConfig.Modules memory m =
            ModuleMatrix.fromMask(ModuleMatrix.BIT_DYNAMIC_FEES | ModuleMatrix.BIT_ANTI_SNIPE);
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 5, 2, m);
        uint256 bought = _buySplit(launchId, token, _twoWay(15e6, 15e6));
        assertGt(bought, 0, "snipe tax + dyn fee still fill");
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_KitchenSinkNoFloor_MaxTxAntiMev() public onlyFork {
        BitmaskConfig.Modules memory m = _multiSinkModules();
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, m);

        // maxTx is 1% of supply (~$50 at $5k FDV); keep the clip small.
        uint256 bought = _buySplit(launchId, token, _twoWay(5e6, 5e6));
        assertGt(bought, 0, "kitchen sink buy");

        uint256 sellAmt = IERC20(token).balanceOf(trader) / 4;
        vm.startPrank(trader);
        IERC20(token).approve(address(aggregator), sellAmt);
        BalancedAggregator.RouteLeg[] memory sellLegs = new BalancedAggregator.RouteLeg[](1);
        sellLegs[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: sellAmt, minAmountOut: 1});
        vm.expectRevert();
        aggregator.sellExactInput(launchId, token, sellAmt, 1, sellLegs, trader, block.timestamp + 600);
        vm.stopPrank();

        vm.roll(block.number + 1);
        _sellOne(launchId, token, 0, sellAmt);
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_BuybackVesting() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.buybackVesting = true;
        m.hookTaxBps = 200;
        m.buybackVestingDurationSeconds = 7 days;
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 3, 2, m);
        assertGt(_buySplit(launchId, token, _twoWay(40e6, 40e6)), 0);
        (, uint128 streamed,,,) = buybacks.streams(creator, token);
        assertGt(streamed, 0, "buyback stream");
    }

    // ─── Sells / recipient ────────────────────────────────────────────────────

    function testFork_BalancedAggregator_SellSplitTwoMarkets() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 6, 2, _defaultModules());
        uint256 bought = _buySplit(launchId, token, _twoWay(50e6, 50e6));
        vm.roll(block.number + 1);

        uint256 sellAmt = (bought / 4) * 2;
        uint256 half = sellAmt / 2;
        BalancedAggregator.RouteLeg[] memory sellLegs = _twoWayIndexed(half, sellAmt - half, 0, 1);

        vm.startPrank(trader);
        IERC20(token).approve(address(aggregator), sellAmt);
        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 usdgOut = aggregator.sellExactInput(
            launchId, token, sellAmt, 1, sellLegs, trader, block.timestamp + 600
        );
        vm.stopPrank();
        assertGt(usdgOut, 0, "split sell");
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore + usdgOut, "sell credit");
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_SellSplitFourStocks() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 4, _defaultModules());
        BalancedAggregator.RouteLeg[] memory buyLegs = new BalancedAggregator.RouteLeg[](4);
        for (uint256 i; i < 4; ++i) {
            buyLegs[i] = BalancedAggregator.RouteLeg({marketIndex: uint8(i), amountIn: 20e6, minAmountOut: 1});
        }
        uint256 bought = _buySplit(launchId, token, buyLegs);
        assertGt(bought, 0, "4-way buy");
        vm.roll(block.number + 1);

        uint256 sellAmt = bought / 10;
        require(sellAmt >= 4, "sell too small");
        uint256 slice = sellAmt / 4;
        BalancedAggregator.RouteLeg[] memory sellLegs = new BalancedAggregator.RouteLeg[](4);
        uint256 filled;
        for (uint256 i; i < 4; ++i) {
            uint256 amt = i == 3 ? sellAmt - filled : slice;
            filled += amt;
            sellLegs[i] = BalancedAggregator.RouteLeg({marketIndex: uint8(i), amountIn: amt, minAmountOut: 1});
        }

        vm.startPrank(trader);
        IERC20(token).approve(address(aggregator), sellAmt);
        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 usdgOut = aggregator.sellExactInput(
            launchId, token, sellAmt, 1, sellLegs, trader, block.timestamp + 600
        );
        vm.stopPrank();
        assertGt(usdgOut, 0, "4-way sell");
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore + usdgOut, "sell credit");
        assertEq(IERC20(token).balanceOf(address(aggregator)), 0, "token leftover");
        _assertAggregatorEmpty(token);
    }

    function testFork_BalancedAggregator_RecipientNotPayer() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), 30e6);
        uint256 traderTok = IERC20(token).balanceOf(trader);
        uint256 opsTok = IERC20(token).balanceOf(ops);
        uint256 bought = aggregator.buyExactInput(
            launchId, token, 30e6, 1, _twoWay(20e6, 10e6), ops, block.timestamp + 600
        );
        vm.stopPrank();

        assertGt(bought, 0);
        assertEq(IERC20(token).balanceOf(trader), traderTok, "payer received tokens");
        assertEq(IERC20(token).balanceOf(ops), opsTok + bought, "recipient missed tokens");
    }

    function testFork_BalancedAggregator_SingleLegMatchesRouter() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        Currency stock = _quoteCurrency(hookKey, token);
        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(stock));
        uint256 usdgIn = 20e6;

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), type(uint256).max);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), type(uint256).max);

        uint256 snap = vm.snapshotState();
        uint256 routerOut = router.swapExactInComposite(
            bridgeKey,
            QuotronBridge.zeroForOne(Currency.unwrap(stock), Currency.unwrap(usdg)),
            usdgIn,
            hookKey,
            _buyZeroForOne(hookKey, token),
            stock,
            1,
            0,
            0
        );
        assertTrue(vm.revertToState(snap), "restore");

        BalancedAggregator.RouteLeg[] memory legs = new BalancedAggregator.RouteLeg[](1);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: usdgIn, minAmountOut: 1});
        uint256 aggOut = aggregator.buyExactInput(launchId, token, usdgIn, 1, legs, trader, block.timestamp + 600);
        vm.stopPrank();

        assertApproxEqRel(aggOut, routerOut, 0.02e18, "aggregator drifted from canonical router");
    }

    // ─── Reverts / validation ─────────────────────────────────────────────────

    function testFork_BalancedAggregator_NonCanonicalQuoteUnsupported() public onlyFork {
        MockQuoteToken mock = new MockQuoteToken("Mock", "MCK", 18);
        factory.setQuote(address(mock), true, 18, 1e18, address(0));
        Currency[] memory quotes = new Currency[](2);
        quotes[0] = Currency.wrap(address(mock));
        quotes[1] = usdg;
        (uint256 launchId, address token) = _launchQuotes(quotes, _defaultModules());

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), 10e6);
        BalancedAggregator.RouteLeg[] memory mockLeg = new BalancedAggregator.RouteLeg[](1);
        mockLeg[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 10e6, minAmountOut: 1});
        vm.expectRevert(BalancedAggregator.UnsupportedQuote.selector);
        aggregator.buyExactInput(launchId, token, 10e6, 1, mockLeg, trader, block.timestamp + 600);

        BalancedAggregator.RouteLeg[] memory usdgLeg = new BalancedAggregator.RouteLeg[](1);
        usdgLeg[0] = BalancedAggregator.RouteLeg({marketIndex: 1, amountIn: 10e6, minAmountOut: 1});
        uint256 bought =
            aggregator.buyExactInput(launchId, token, 10e6, 1, usdgLeg, trader, block.timestamp + 600);
        vm.stopPrank();
        assertGt(bought, 0, "USDG leg of mixed launch");
    }

    function testFork_BalancedAggregator_ValidationErrors() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        BalancedAggregator.RouteLeg[] memory legs = _twoWay(10e6, 10e6);

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), type(uint256).max);

        vm.expectRevert(BalancedAggregator.Expired.selector);
        aggregator.buyExactInput(launchId, token, 20e6, 1, legs, trader, block.timestamp - 1);

        vm.expectRevert(BalancedAggregator.DeadlineTooFar.selector);
        aggregator.buyExactInput(launchId, token, 20e6, 1, legs, trader, block.timestamp + 2 days);

        vm.expectRevert(BalancedAggregator.AmountMismatch.selector);
        aggregator.buyExactInput(launchId, token, 19e6, 1, legs, trader, block.timestamp + 600);

        vm.expectRevert(BalancedAggregator.TokenMismatch.selector);
        aggregator.buyExactInput(launchId, address(0xdead), 20e6, 1, legs, trader, block.timestamp + 600);

        BalancedAggregator.RouteLeg[] memory dup = new BalancedAggregator.RouteLeg[](2);
        dup[0] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 10e6, minAmountOut: 1});
        dup[1] = BalancedAggregator.RouteLeg({marketIndex: 0, amountIn: 10e6, minAmountOut: 1});
        vm.expectRevert(BalancedAggregator.UnknownMarket.selector);
        aggregator.buyExactInput(launchId, token, 20e6, 1, dup, trader, block.timestamp + 600);

        BalancedAggregator.RouteLeg[] memory badIx = new BalancedAggregator.RouteLeg[](1);
        badIx[0] = BalancedAggregator.RouteLeg({marketIndex: 7, amountIn: 10e6, minAmountOut: 1});
        vm.expectRevert(BalancedAggregator.UnknownMarket.selector);
        aggregator.buyExactInput(launchId, token, 10e6, 1, badIx, trader, block.timestamp + 600);

        BalancedAggregator.RouteLeg[] memory empty;
        vm.expectRevert(BalancedAggregator.InvalidLegCount.selector);
        aggregator.buyExactInput(launchId, token, 10e6, 1, empty, trader, block.timestamp + 600);

        vm.expectRevert(BalancedAggregator.ZeroAmount.selector);
        aggregator.buyExactInput(launchId, token, 0, 1, legs, trader, block.timestamp + 600);
        vm.stopPrank();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _multiSinkModules() internal pure returns (BitmaskConfig.Modules memory) {
        uint16 mask = uint16(ModuleMatrix.EXTENDED_MASK_SPACE - 1) & ~ModuleMatrix.BIT_BUYBACK_VESTING
            & ~ModuleMatrix.BIT_BACKED_FLOOR;
        return ModuleMatrix.fromExtendedMask(mask);
    }

    function _twoWay(uint256 a, uint256 b) internal pure returns (BalancedAggregator.RouteLeg[] memory legs) {
        return _twoWayIndexed(a, b, 0, 1);
    }

    function _twoWayIndexed(uint256 a, uint256 b, uint8 ia, uint8 ib)
        internal
        pure
        returns (BalancedAggregator.RouteLeg[] memory legs)
    {
        legs = new BalancedAggregator.RouteLeg[](2);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: ia, amountIn: a, minAmountOut: 1});
        legs[1] = BalancedAggregator.RouteLeg({marketIndex: ib, amountIn: b, minAmountOut: 1});
    }

    function _buySplit(uint256 launchId, address token, BalancedAggregator.RouteLeg[] memory legs)
        internal
        returns (uint256 bought)
    {
        uint256 usdgIn;
        for (uint256 i; i < legs.length; ++i) usdgIn += legs[i].amountIn;
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), usdgIn);
        bought = aggregator.buyExactInput(launchId, token, usdgIn, 1, legs, trader, block.timestamp + 600);
        vm.stopPrank();
    }

    function _tryBuy(uint256 launchId, address token, BalancedAggregator.RouteLeg[] memory legs)
        internal
        returns (uint256 bought)
    {
        uint256 usdgIn;
        for (uint256 i; i < legs.length; ++i) usdgIn += legs[i].amountIn;
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(aggregator), usdgIn);
        try aggregator.buyExactInput(launchId, token, usdgIn, 1, legs, trader, block.timestamp + 600) returns (
            uint256 out
        ) {
            bought = out;
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), BalancedAggregator.PriceImpactTooHigh.selector, "unexpected buy revert");
            bought = 0;
        }
        vm.stopPrank();
    }

    function _sellOne(uint256 launchId, address token, uint8 marketIndex, uint256 amount) internal {
        BalancedAggregator.RouteLeg[] memory legs = new BalancedAggregator.RouteLeg[](1);
        legs[0] = BalancedAggregator.RouteLeg({marketIndex: marketIndex, amountIn: amount, minAmountOut: 1});
        vm.startPrank(trader);
        IERC20(token).approve(address(aggregator), amount);
        uint256 out = aggregator.sellExactInput(launchId, token, amount, 1, legs, trader, block.timestamp + 600);
        vm.stopPrank();
        assertGt(out, 0, "sell");
    }

    function _launchStockGroup(
        QuotronStockQuotes.Listing[] memory stocks,
        uint256 start,
        uint256 count,
        BitmaskConfig.Modules memory modules
    ) internal returns (uint256 launchId, address token) {
        Currency[] memory quotes = new Currency[](count);
        for (uint256 i; i < count; ++i) {
            quotes[i] = Currency.wrap(stocks[start + i].token);
        }
        return _launchQuotes(quotes, modules);
    }

    function _launchQuotes(Currency[] memory quotes, BitmaskConfig.Modules memory modules)
        internal
        returns (uint256 launchId, address token)
    {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](quotes.length);
        for (uint256 i; i < quotes.length; ++i) {
            uint16 bps = uint16(10_000 / quotes.length);
            if (i == quotes.length - 1) bps = uint16(10_000 - uint256(bps) * (quotes.length - 1));
            markets[i] = LaunchFactory.MarketInput({quote: quotes[i], bps: bps});
        }

        vm.prank(creator);
        (launchId, token,) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "BalancedAgg",
                symbol: "BAGG",
                metadataURI: "ipfs://balanced-agg",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(ModuleMatrix.ensureFeeRoute(modules)),
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );
    }

    function _assertAggregatorEmpty(address token) internal view {
        assertEq(IERC20(token).balanceOf(address(aggregator)), 0, "aggregator retained token");
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(address(aggregator)), 0, "aggregator retained USDG");
        assertEq(manager.balanceOf(address(aggregator), usdg.toId()), 0, "aggregator retained USDG claims");
    }
}
