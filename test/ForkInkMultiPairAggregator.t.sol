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
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice End-to-end coverage for the frontend multi-pool aggregator's executable routes.
/// @dev The TypeScript suite checks route selection; this fork suite checks that every
///      selected direct/composite leg is atomic and isolated on live Ink v4 state.
contract ForkInkMultiPairAggregatorTest is InkForkTestBase {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            deal(stocks[i].token, trader, 2_000e18);
        }
    }

    /// @notice Two multi-market launches cover all nine Quotrons pairings.
    ///         Every market is exercised both directly and through USDG in both directions.
    function testFork_MultiPair_AllNineStocks_DirectAndCompositeRoundTrips() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        _exerciseGroup(stocks, 0, 5);
        _exerciseGroup(stocks, 5, stocks.length - 5);
    }

    /// @notice A failed minOut check rolls back both v4 legs, balances and pool prices.
    function testFork_MultiPair_CompositeSlippageIsAtomic_BuyAndSell() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        Currency stock = _quoteCurrency(hookKey, token);
        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(stock));
        bool bridgeBuyZfo = QuotronBridge.zeroForOne(Currency.unwrap(stock), Currency.unwrap(usdg));
        bool hookBuyZfo = _buyZeroForOne(hookKey, token);
        uint256 usdgIn = 75e6;

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), type(uint256).max);
        uint256 buySnapshot = vm.snapshotState();
        uint256 expectedTokens =
            router.swapExactInComposite(bridgeKey, bridgeBuyZfo, usdgIn, hookKey, hookBuyZfo, stock, 1, 0, 0);
        assertTrue(vm.revertToState(buySnapshot), "restore buy quote state");

        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 tokenBefore = IERC20(token).balanceOf(trader);
        (uint160 hookPriceBefore,,,) = manager.getSlot0(hookKey.toId());
        (uint160 bridgePriceBefore,,,) = manager.getSlot0(bridgeKey.toId());

        vm.expectRevert(HookitSwapRouter.InsufficientOutput.selector);
        router.swapExactInComposite(
            bridgeKey, bridgeBuyZfo, usdgIn, hookKey, hookBuyZfo, stock, expectedTokens + 1, 0, 0
        );
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore, "buy revert spent USDG");
        assertEq(IERC20(token).balanceOf(trader), tokenBefore, "buy revert delivered token");
        (uint160 hookPriceAfterRevert,,,) = manager.getSlot0(hookKey.toId());
        (uint160 bridgePriceAfterRevert,,,) = manager.getSlot0(bridgeKey.toId());
        assertEq(hookPriceAfterRevert, hookPriceBefore, "buy revert moved hook pool");
        assertEq(bridgePriceAfterRevert, bridgePriceBefore, "buy revert moved bridge pool");

        uint256 tokensOut = router.swapExactInComposite(
            bridgeKey, bridgeBuyZfo, usdgIn, hookKey, hookBuyZfo, stock, expectedTokens, 0, 0
        );
        assertEq(tokensOut, expectedTokens, "buy output changed from same state");
        assertEq(
            IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore - usdgIn, "buy must refund ERC20 settle buffer"
        );

        vm.roll(block.number + 1);
        uint256 sellAmount = tokensOut / 3;
        IERC20(token).approve(address(router), type(uint256).max);
        uint256 sellSnapshot = vm.snapshotState();
        uint256 expectedUsdg =
            router.swapExactInCompositeSell(bridgeKey, !bridgeBuyZfo, sellAmount, hookKey, !hookBuyZfo, stock, 1, 0, 0);
        assertTrue(vm.revertToState(sellSnapshot), "restore sell quote state");

        usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        tokenBefore = IERC20(token).balanceOf(trader);
        (hookPriceBefore,,,) = manager.getSlot0(hookKey.toId());
        (bridgePriceBefore,,,) = manager.getSlot0(bridgeKey.toId());

        vm.expectRevert(HookitSwapRouter.InsufficientOutput.selector);
        router.swapExactInCompositeSell(
            bridgeKey, !bridgeBuyZfo, sellAmount, hookKey, !hookBuyZfo, stock, expectedUsdg + 1, 0, 0
        );
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore, "sell revert delivered USDG");
        assertEq(IERC20(token).balanceOf(trader), tokenBefore, "sell revert spent token");
        (hookPriceAfterRevert,,,) = manager.getSlot0(hookKey.toId());
        (bridgePriceAfterRevert,,,) = manager.getSlot0(bridgeKey.toId());
        assertEq(hookPriceAfterRevert, hookPriceBefore, "sell revert moved hook pool");
        assertEq(bridgePriceAfterRevert, bridgePriceBefore, "sell revert moved bridge pool");

        uint256 usdgOut = router.swapExactInCompositeSell(
            bridgeKey, !bridgeBuyZfo, sellAmount, hookKey, !hookBuyZfo, stock, expectedUsdg, 0, 0
        );
        vm.stopPrank();

        assertEq(usdgOut, expectedUsdg, "sell output changed from same state");
        assertEq(IERC20(token).balanceOf(trader), tokenBefore - sellAmount, "sell spent more than exact input");
        assertEq(
            IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore + expectedUsdg, "sell output balance mismatch"
        );
        _assertRouterEmpty(token, stock);
    }

    /// @notice Trading one leg must not alter another Hookit market or fund its fee pot.
    function testFork_MultiPair_PoolAndFeeAccountingAreIsolatedPerQuote() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        BitmaskConfig.Modules memory modules = _defaultModules();
        modules.holderAirdrop = true;
        modules.holderAirdropBps = 10_000;
        modules.holderAirdropEpochSeconds = 60;
        modules.hookTaxBps = 200;

        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 3, modules);
        PoolKey memory tradedKey = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory idleKey1 = factory.poolKeyOfMarket(launchId, 1);
        PoolKey memory idleKey2 = factory.poolKeyOfMarket(launchId, 2);
        Currency tradedQuote = _quoteCurrency(tradedKey, token);
        Currency idleQuote1 = _quoteCurrency(idleKey1, token);
        Currency idleQuote2 = _quoteCurrency(idleKey2, token);
        (uint160 tradedBefore,,,) = manager.getSlot0(tradedKey.toId());
        (uint160 idleBefore1,,,) = manager.getSlot0(idleKey1.toId());
        (uint160 idleBefore2,,,) = manager.getSlot0(idleKey2.toId());

        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(tradedQuote));
        bool bridgeZfo = QuotronBridge.zeroForOne(Currency.unwrap(tradedQuote), Currency.unwrap(usdg));
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), 100e6);
        router.swapExactInComposite(
            bridgeKey, bridgeZfo, 100e6, tradedKey, _buyZeroForOne(tradedKey, token), tradedQuote, 1, 0, 0
        );
        vm.stopPrank();

        (uint160 tradedAfter,,,) = manager.getSlot0(tradedKey.toId());
        (uint160 idleAfter1,,,) = manager.getSlot0(idleKey1.toId());
        (uint160 idleAfter2,,,) = manager.getSlot0(idleKey2.toId());
        assertTrue(tradedAfter != tradedBefore, "selected Hookit market did not move");
        assertEq(idleAfter1, idleBefore1, "trade contaminated market 1");
        assertEq(idleAfter2, idleBefore2, "trade contaminated market 2");
        assertGt(airdrops.potOf(token, tradedQuote), 0, "selected quote fee pot empty");
        assertEq(airdrops.potOf(token, idleQuote1), 0, "idle quote 1 received fees");
        assertEq(airdrops.potOf(token, idleQuote2), 0, "idle quote 2 received fees");
    }

    function testFork_MultiPair_RejectsQuoteThatIsNotTheSelectedMarket() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        (uint256 launchId, address token) = _launchStockGroup(stocks, 0, 2, _defaultModules());
        PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, 0);
        Currency stock = _quoteCurrency(hookKey, token);
        PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(stock));

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), 10e6);
        vm.expectRevert(HookitSwapRouter.QuoteMismatch.selector);
        router.swapExactInComposite(
            bridgeKey,
            QuotronBridge.zeroForOne(Currency.unwrap(stock), Currency.unwrap(usdg)),
            10e6,
            hookKey,
            _buyZeroForOne(hookKey, token),
            usdg,
            1,
            0,
            0
        );
        vm.stopPrank();
    }

    function _exerciseGroup(QuotronStockQuotes.Listing[] memory stocks, uint256 start, uint256 count) private {
        (uint256 launchId, address token) = _launchStockGroup(stocks, start, count, _defaultModules());
        assertEq(factory.launchMarketCount(launchId), count, "multi market count");

        for (uint256 i; i < count; ++i) {
            PoolKey memory hookKey = factory.poolKeyOfMarket(launchId, i);
            Currency stock = Currency.wrap(stocks[start + i].token);
            assertEq(Currency.unwrap(_quoteCurrency(hookKey, token)), Currency.unwrap(stock), "market quote");

            uint256 stockIn = 0.01e18;
            vm.startPrank(trader);
            IERC20(Currency.unwrap(stock)).approve(address(router), stockIn);
            uint256 directTokens = router.swapExactIn(hookKey, _buyZeroForOne(hookKey, token), stockIn, 1, 0);
            assertGt(directTokens, 0, "direct buy");
            vm.roll(block.number + 1);
            IERC20(token).approve(address(router), directTokens / 4);
            uint256 stockOut = router.swapExactIn(hookKey, !_buyZeroForOne(hookKey, token), directTokens / 4, 1, 0);
            vm.stopPrank();
            assertGt(stockOut, 0, "direct sell");

            PoolKey memory bridgeKey = QuotronBridge.poolKey(Currency.unwrap(stock));
            bool bridgeBuyZfo = QuotronBridge.zeroForOne(Currency.unwrap(stock), Currency.unwrap(usdg));
            vm.startPrank(trader);
            IERC20(Currency.unwrap(usdg)).approve(address(router), 25e6);
            uint256 compositeTokens = router.swapExactInComposite(
                bridgeKey, bridgeBuyZfo, 25e6, hookKey, _buyZeroForOne(hookKey, token), stock, 1, 0, 0
            );
            assertGt(compositeTokens, 0, "composite buy");
            vm.roll(block.number + 1);
            IERC20(token).approve(address(router), compositeTokens / 4);
            uint256 usdgOut = router.swapExactInCompositeSell(
                bridgeKey, !bridgeBuyZfo, compositeTokens / 4, hookKey, !_buyZeroForOne(hookKey, token), stock, 1, 0, 0
            );
            vm.stopPrank();
            assertGt(usdgOut, 0, "composite sell");
            _assertRouterEmpty(token, stock);
        }
    }

    function _launchStockGroup(
        QuotronStockQuotes.Listing[] memory stocks,
        uint256 start,
        uint256 count,
        BitmaskConfig.Modules memory modules
    ) private returns (uint256 launchId, address token) {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](count);
        for (uint256 i; i < count; ++i) {
            uint16 bps = uint16(10_000 / count);
            if (i == count - 1) bps = uint16(10_000 - uint256(bps) * (count - 1));
            markets[i] = LaunchFactory.MarketInput({quote: Currency.wrap(stocks[start + i].token), bps: bps});
        }

        vm.prank(creator);
        (launchId, token,) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "AggregateMulti",
                symbol: "AGGM",
                metadataURI: "ipfs://aggregate-multi",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(modules),
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function _assertRouterEmpty(address token, Currency stock) private view {
        assertEq(address(router).balance, 0, "router retained ETH");
        assertEq(IERC20(token).balanceOf(address(router)), 0, "router retained launch token");
        assertEq(IERC20(Currency.unwrap(stock)).balanceOf(address(router)), 0, "router retained stock");
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(address(router)), 0, "router retained USDG");
        assertEq(manager.balanceOf(address(router), stock.toId()), 0, "router retained stock claims");
        assertEq(manager.balanceOf(address(router), usdg.toId()), 0, "router retained USDG claims");
    }
}
