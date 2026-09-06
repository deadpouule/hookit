// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {EthUsdgBridgeSeeder} from "../src/EthUsdgBridgeSeeder.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";

/// @notice Ink fork: Quotrons composite buy + fee rail wStock→USDG→ETH.
contract ForkInkCompositeAndRailTest is InkForkTestBase {
    using CurrencyLibrary for Currency;

    FeeEthRail internal feeRail;
    EthUsdgBridgeSeeder internal seeder;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        feeRail = new FeeEthRail(deployer, manager, Currency.unwrap(usdg));
        distributor.setFeeRail(feeRail);
        EthUsdgBridgeLib.initializeEmpty(manager, Currency.unwrap(usdg));
        EthUsdgBridgeLib.wireLive(manager, feeRail, EthUsdgBridgeLib.poolKey(Currency.unwrap(usdg)), address(0));
        seeder = new EthUsdgBridgeSeeder(manager);

        deal(Currency.unwrap(usdg), address(this), 2_000_000e6);
        IERC20(Currency.unwrap(usdg)).approve(address(seeder), type(uint256).max);
        seeder.seed{value: 20 ether}(Currency.unwrap(usdg), 2_000_000e6, -600, 600, 1e18);
    }

    function testFork_CompositeUsdgToWspyxToToken() public onlyFork {
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, wspyx, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Cmp", "CMP");

        PoolKey memory bridgeKey = QuotronBridge.poolKey(QuotronStockQuotes.wSPYx);
        bool bridgeZfo = QuotronBridge.zeroForOne(QuotronStockQuotes.wSPYx, Currency.unwrap(usdg));

        uint256 usdgIn = 50e6;
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), usdgIn);

        uint256 balBefore = _tokenBalance(l.token, trader);
        bool hookZfo = _buyZeroForOne(l.key, l.token);
        uint256 tokensOut = router.swapExactInComposite(bridgeKey, bridgeZfo, usdgIn, l.key, hookZfo, wspyx, 1, 0, 0);
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(_tokenBalance(l.token, trader), balBefore + tokensOut);
    }

    function testFork_CompositeSell_TokenToWspyxToUsdg() public onlyFork {
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, wspyx, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Sell", "SEL");

        _assertSpotFdvFiveThousandUsd(l.key, l.token, wspyx);

        PoolKey memory bridgeKey = QuotronBridge.poolKey(QuotronStockQuotes.wSPYx);
        bool bridgeZfo = QuotronBridge.zeroForOne(QuotronStockQuotes.wSPYx, Currency.unwrap(usdg));

        uint256 usdgIn = 80e6;
        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), usdgIn);
        bool hookBuyZfo = _buyZeroForOne(l.key, l.token);
        uint256 tokensOut =
            router.swapExactInComposite(bridgeKey, bridgeZfo, usdgIn, l.key, hookBuyZfo, wspyx, 1, 0, 0);
        vm.stopPrank();
        assertGt(tokensOut, 0);

        vm.roll(block.number + 1);
        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 spyBefore = IERC20(Currency.unwrap(wspyx)).balanceOf(trader);
        uint256 sellAmt = tokensOut / 3;
        uint256 usdgOut = _compositeSellToUsdg(trader, l.key, l.token, sellAmt, wspyx);

        assertGt(usdgOut, 0);
        assertEq(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore + usdgOut);
        // Intermediate wSPYx stays in the unlock — trader wSPYx must not be spent.
        assertEq(IERC20(Currency.unwrap(wspyx)).balanceOf(trader), spyBefore);
    }

    function testFork_LiveStockUsd_DrivesMcapNotSnapshot() public onlyFork {
        uint256 live = QuotronBridge.usdPriceX18(manager, QuotronStockQuotes.wSPYx);
        assertGt(live, 0, "Quotrons pool must be live");
        assertEq(factory.quoteUsdPriceX18(Currency.unwrap(wspyx)), live, "factory must read pool sqrtPrice");

        uint256 snapshot = _wspyxListingUsd();
        uint256 mcapLive = factory.mcapQuoteFor(Currency.unwrap(wspyx));
        uint256 expectedLive =
            FixedPointMath.mcapQuoteWei(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, live, 18);
        assertEq(mcapLive, expectedLive, "mcap must use live USD");

        if (live != snapshot) {
            uint256 expectedSnap =
                FixedPointMath.mcapQuoteWei(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, snapshot, 18);
            assertTrue(mcapLive != expectedSnap, "must not size FDV from hardcoded listing");
        }
    }

    function testFork_LaunchMulti_EthUsdgWspyx_LiveFdvAndCompositeSell() public onlyFork {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](3);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 4_000});
        markets[1] = LaunchFactory.MarketInput({quote: usdg, bps: 3_000});
        markets[2] = LaunchFactory.MarketInput({quote: wspyx, bps: 3_000});

        InkForkTestBase.LaunchResult memory l = _launchMulti(creator, markets, "Multi", "MLT");
        assertEq(factory.launchMarketCount(l.launchId), 3);

        PoolKey memory ethKey = factory.poolKeyOfMarket(l.launchId, 0);
        PoolKey memory usdgKey = factory.poolKeyOfMarket(l.launchId, 1);
        PoolKey memory spyKey = factory.poolKeyOfMarket(l.launchId, 2);

        _assertSpotFdvFiveThousandUsd(ethKey, l.token, Currency.wrap(address(0)));
        _assertSpotFdvFiveThousandUsd(usdgKey, l.token, usdg);
        _assertSpotFdvFiveThousandUsd(spyKey, l.token, wspyx);

        _routerBuy(trader, ethKey, l.token, 0.05 ether);
        _routerBuy(trader, usdgKey, l.token, 100e6);
        _routerBuy(trader, spyKey, l.token, 0.02e18);
        uint256 tokens = _tokenBalance(l.token, trader);
        assertGt(tokens, 0);

        vm.roll(block.number + 1);
        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
        uint256 usdgOut = _compositeSellToUsdg(trader, spyKey, l.token, tokens / 5, wspyx);
        assertGt(usdgOut, 0);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore);
    }

    function testFork_EthUsdForFdvIsLiveFeedWhenFresh() public onlyFork {
        uint256 used = factory.quoteUsdPriceX18(address(0));
        assertGt(used, 0);
        uint256 expectedMcap = factory.launchMcapQuoteWei();
        assertEq(
            expectedMcap,
            FixedPointMath.mcapQuoteFromUsd(ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, used)
        );
    }

    function _wspyxListingUsd() internal pure returns (uint256) {
        QuotronStockQuotes.Listing[] memory all = QuotronStockQuotes.listings();
        for (uint256 i; i < all.length; ++i) {
            if (all[i].token == QuotronStockQuotes.wSPYx) return all[i].usdPriceX18;
        }
        revert("wSPYx listing missing");
    }

    function testFork_FeeRail_StockToUsdgThenBuybackWallet() public onlyFork {
        distributor.setBuybackExecutor(address(hkitBuyback));

        uint256 stockIn = 0.01e18;
        deal(Currency.unwrap(wspyx), address(this), stockIn);
        IERC20(Currency.unwrap(wspyx)).approve(address(distributor), stockIn);
        distributor.notify(wspyx, stockIn);

        uint256 opsUsdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(ops);
        uint256 buybackUsdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(address(hkitBuyback));

        distributor.distributeToBuyback(wspyx, 1);

        assertEq(distributor.pending(wspyx), 0);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(ops), opsUsdgBefore);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(address(hkitBuyback)), buybackUsdgBefore);
    }

    function testFork_CompositeRejectsForeignBridgeHook() public onlyFork {
        PoolKey memory bridgeKey = QuotronBridge.poolKey(QuotronStockQuotes.wSPYx);
        bridgeKey.hooks = IHooks(address(hook));

        vm.startPrank(trader);
        IERC20(Currency.unwrap(usdg)).approve(address(router), 1e6);
        vm.expectRevert(HookitSwapRouter.UnauthorizedBridgeHook.selector);
        router.swapExactInComposite(
            bridgeKey,
            true,
            1e6,
            PoolKey({
                currency0: Currency.wrap(address(0)),
                currency1: Currency.wrap(address(0xBEEF)),
                fee: 0,
                tickSpacing: 60,
                hooks: IHooks(address(hook))
            }),
            true,
            Currency.wrap(address(0)),
            1,
            0,
            0
        );
        vm.stopPrank();
    }
}
