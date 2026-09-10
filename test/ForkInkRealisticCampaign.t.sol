// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {QuotronBridge} from "../src/libraries/QuotronBridge.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";

/// @notice High-volume preproduction campaign on a persistent Ink mainnet fork.
/// @dev Complements the 512-mask exhaustive suite with every live quote, realistic
///      trade sizes, varied supplies/tick spacings, multi-market cohabitation and dev buys.
contract ForkInkRealisticCampaignTest is InkForkTestBase {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    address internal trader2;
    address internal trader3;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        trader2 = makeAddr("realisticTrader2");
        trader3 = makeAddr("realisticTrader3");
        vm.deal(trader2, 500 ether);
        vm.deal(trader3, 500 ether);
        deal(Currency.unwrap(usdg), trader2, 5_000_000e6);
        deal(Currency.unwrap(usdg), trader3, 5_000_000e6);

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            deal(stocks[i].token, creator, 2_000e18);
            deal(stocks[i].token, trader, 2_000e18);
            deal(stocks[i].token, trader2, 2_000e18);
            deal(stocks[i].token, trader3, 2_000e18);
        }
    }

    /// @notice 11 tokens, one for every quote. Each receives $10, $100 and $500 buys,
    ///         then partial sells, with three supplies and three tick spacings.
    function testFork_AllQuotes_RealisticAmountsSuppliesAndSpacings() public onlyFork {
        Currency[] memory quotes = _allQuotes();
        address[3] memory users = [trader, trader2, trader3];
        uint256[3] memory usdSizes = [uint256(10e18), uint256(100e18), uint256(500e18)];

        for (uint256 i; i < quotes.length; ++i) {
            uint256 supply = _supplyFor(i);
            int24 spacing = i % 3 == 0 ? int24(10) : (i % 3 == 1 ? int24(60) : int24(200));
            LaunchResult memory l = _launch(creator, quotes[i], _defaultModules(), spacing, supply, "RealQuote", "RQT");
            _assertLaunchFdv(l.key, l.token, quotes[i], supply);

            uint256 escrowBefore = escrow.balanceOf(creator, quotes[i]);
            uint256 protocolBefore = distributor.pending(quotes[i]);
            for (uint256 j; j < users.length; ++j) {
                _routerBuy(users[j], l.key, l.token, _quoteForUsd(quotes[i], usdSizes[j]));
                assertGt(_tokenBalance(l.token, users[j]), 0, "realistic buy");
                vm.roll(block.number + 1);
            }

            uint256 quoteBefore = _balanceOf(quotes[i], trader2);
            _routerSell(trader2, l.key, l.token, _tokenBalance(l.token, trader2) / 3);
            assertGt(_balanceOf(quotes[i], trader2), quoteBefore, "realistic sell");
            assertTrue(
                escrow.balanceOf(creator, quotes[i]) > escrowBefore || distributor.pending(quotes[i]) > protocolBefore,
                "fees must accrue"
            );
        }
    }

    /// @notice Every live quote with all compatible modules enabled together.
    function testFork_KitchenSink_AllElevenQuotes() public onlyFork {
        Currency[] memory quotes = _allQuotes();
        for (uint256 i; i < quotes.length; ++i) {
            BitmaskConfig.Modules memory m = ModuleMatrix.kitchenSink();
            // Limits and anti-MEV have dedicated tests; removing them here allows
            // every fee-route side effect to be asserted after meaningful volume.
            m.maxTx = false;
            m.maxTxBps = 0;
            m.maxWallet = false;
            m.maxWalletBps = 0;
            m.antiMev = false;

            LaunchResult memory l =
                _launch(creator, quotes[i], m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "AllHooks", "AHK");
            uint256 supplyBefore = IERC20(l.token).totalSupply();
            uint128 seedLiq = hook.launchState(l.poolId).seedLiquidity;

            _routerBuy(trader, l.key, l.token, _quoteForUsd(quotes[i], 150e18));

            assertGt(vault.reserve(l.token), 0, "floor pot");
            assertGt(airdrops.potOf(l.token, quotes[i]), 0, "airdrop pot");
            assertTrue(
                IERC20(l.token).totalSupply() < supplyBefore || hook.pendingAutoBurn(l.poolId) > 0, "burn effect"
            );
            assertTrue(manager.getLiquidity(l.poolId) > seedLiq || hook.pendingLpDonate(l.poolId) > 0, "LP deepen");

            vm.roll(block.number + 1);
            _routerSell(trader, l.key, l.token, _tokenBalance(l.token, trader) / 10);
        }
    }

    /// @notice Vesting and holder airdrop coexist for every quote; this is the
    ///         compatible alternative to creatorShareToHook used by kitchen-sink.
    function testFork_VestingAndAirdrop_AllElevenQuotes() public onlyFork {
        Currency[] memory quotes = _allQuotes();
        for (uint256 i; i < quotes.length; ++i) {
            BitmaskConfig.Modules memory m = _defaultModules();
            m.buybackVesting = true;
            m.buybackVestingDurationSeconds = uint32(30 days);
            m.holderAirdrop = true;
            m.holderAirdropBps = 10_000;
            m.holderAirdropEpochSeconds = 60;
            m.hookTaxBps = 200;

            LaunchResult memory l =
                _launch(creator, quotes[i], m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "VestDrop", "VDP");
            _routerBuy(trader, l.key, l.token, _quoteForUsd(quotes[i], 200e18));

            (, uint128 streamed,,,) = buybacks.streams(creator, l.token);
            assertGt(streamed, 0, "vesting stream");
            assertGt(airdrops.potOf(l.token, quotes[i]), 0, "airdrop reserve");

            vm.warp(block.timestamp + 61);
            vm.roll(block.number + 1);
            _routerBuy(trader2, l.key, l.token, _quoteForUsd(quotes[i], 10e18));
            vm.roll(block.number + 1);
            _routerBuy(trader3, l.key, l.token, _quoteForUsd(quotes[i], 10e18));
            assertGt(airdrops.lastAirdropAtQuote(l.token, quotes[i].toId()), 0, "airdrop epoch");
        }
    }

    /// @notice Classic launch, bonding, graduation, post-graduation buy/sell and
    ///         fee sweep for ETH, USDG and all nine wrapped equities.
    function testFork_ClassicFullLifecycle_AllElevenQuotes() public onlyFork {
        Currency[] memory quotes = _allQuotes();
        for (uint256 i; i < quotes.length; ++i) {
            BondingResult memory r = _bondingLaunch(creator, quotes[i], 0, "ClassicAll", "CLA");
            _bondingBuyToGraduate(trader, r.launchId, quotes[i]);
            assertEq(
                uint8(_bondingPhase(r.launchId)), uint8(BondingLaunchFactory.Phase.Graduated), "classic graduation"
            );

            PoolKey memory key = bonding.poolKeyOf(r.launchId);
            _routerBuy(trader2, key, r.token, _quoteForUsd(quotes[i], 100e18));
            vm.roll(block.number + 1);
            _routerSell(trader2, key, r.token, _tokenBalance(r.token, trader2) / 5);

            PoolId poolId = key.toId();
            uint256 pending =
                graduatedHook.pendingFees(poolId, quotes[i]) + graduatedHook.pendingCreatorTax(poolId, quotes[i]);
            if (pending > 0) graduatedHook.sweepQuote(poolId);
            assertTrue(escrow.balanceOf(creator, quotes[i]) > 0 || distributor.pending(quotes[i]) > 0, "classic fees");
        }
    }

    /// @notice Real user route for every wrapped equity: USDG -> wStock -> launch
    ///         token, then launch token -> wStock -> USDG, atomically via v4.
    function testFork_CompositeUsdg_AllNineStocks_BuyAndSell() public onlyFork {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            Currency stock = Currency.wrap(stocks[i].token);
            LaunchResult memory l = _launch(
                creator, stock, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "CompositeAll", "CPA"
            );

            PoolKey memory bridgeKey = QuotronBridge.poolKey(stocks[i].token);
            bool bridgeZfo = QuotronBridge.zeroForOne(stocks[i].token, Currency.unwrap(usdg));
            uint256 usdgIn = 50e6;
            vm.startPrank(trader);
            IERC20(Currency.unwrap(usdg)).approve(address(router), usdgIn);
            uint256 tokensOut = router.swapExactInComposite(
                bridgeKey, bridgeZfo, usdgIn, l.key, _buyZeroForOne(l.key, l.token), stock, 1, 0, 0
            );
            vm.stopPrank();
            assertGt(tokensOut, 0, "composite stock buy");

            vm.roll(block.number + 1);
            uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(trader);
            uint256 usdgOut = _compositeSellToUsdg(trader, l.key, l.token, tokensOut / 4, stock);
            assertGt(usdgOut, 0, "composite stock sell");
            assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(trader), usdgBefore, "USDG returned");
        }
    }

    /// @notice Three 3–5 market tokens cover every quote in multi-market mode.
    ///         Floor, burn, donate, airdrop, vesting and dynamic fees coexist.
    function testFork_MultiMarket_AllQuotesAndCohabitation() public onlyFork {
        Currency[] memory quotes = _allQuotes();
        _runMultiGroup(quotes, 0, 5, 2);
        _runMultiGroup(quotes, 5, 5, 3);
        _runMultiGroup(quotes, 10, 1, 1);
    }

    /// @notice Master launches with small, medium and maximum-sized atomic creator buys.
    function testFork_MasterDevBuy_ThreeRealisticSizes() public onlyFork {
        uint256 maxDevBuy = FixedPointMath.applyBps(factory.launchMcapQuoteWei(), ProtocolConstants.MAX_DEV_BUY_BPS);
        uint256[3] memory sizes = [uint256(0.001 ether), maxDevBuy / 2, maxDevBuy];
        for (uint256 i; i < sizes.length; ++i) {
            vm.prank(creator);
            (uint256 launchId, address token,) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI + sizes[i]}(
                LaunchFactory.LaunchParams({
                    name: "DevBuy",
                    symbol: "DEV",
                    metadataURI: "ipfs://dev-buy",
                    totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                    quote: Currency.wrap(address(0)),
                    tickSpacing: 60,
                    startingTick: 0,
                    bitmask: BitmaskConfig.pack(_defaultModules()),
                    customHook: IHooks(address(0)),
                    devBuyQuoteIn: sizes[i],
                    minDevBuyTokensOut: 1,
                    vestPacked: 0
                })
            );
            assertGt(launchId, 0);
            assertGt(IERC20(token).balanceOf(creator), 0, "master dev buy");
        }

        vm.prank(creator);
        vm.expectRevert();
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI + maxDevBuy + 1}(
            LaunchFactory.LaunchParams({
                name: "DevBuyOverCap",
                symbol: "BADDEV",
                metadataURI: "ipfs://dev-buy-over-cap",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(_defaultModules()),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: maxDevBuy + 1,
                minDevBuyTokensOut: 1,
                vestPacked: 0
            })
        );
    }

    /// @notice The launch fee is 0.0005 ETH. Native Master launches retain one
    ///         wei as PoolManager settlement dust; ERC-20 Master and Classic
    ///         launches route the complete fee to the configured treasury.
    function testFork_LaunchFeeRoutesExactlyToTreasury() public onlyFork {
        uint256 opsBefore = ops.balance;
        uint256 factoryBefore = address(factory).balance;
        _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "FeeEth",
            "FETH"
        );
        assertEq(ops.balance - opsBefore, ProtocolConstants.LAUNCH_FEE_WEI - 1, "Master ETH treasury fee");
        assertEq(address(factory).balance - factoryBefore, 1, "Master ETH settlement dust");

        opsBefore = ops.balance;
        factoryBefore = address(factory).balance;
        _launch(creator, usdg, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "FeeUsdg", "FUSD");
        assertEq(ops.balance - opsBefore, ProtocolConstants.LAUNCH_FEE_WEI, "Master ERC20 treasury fee");
        assertEq(address(factory).balance, factoryBefore, "Master ERC20 keeps no fee");

        opsBefore = ops.balance;
        _bondingLaunch(creator, Currency.wrap(address(0)), 0, "FeeClassic", "FCLS");
        assertEq(ops.balance - opsBefore, ProtocolConstants.LAUNCH_FEE_WEI, "Classic treasury fee");
    }

    function _runMultiGroup(Currency[] memory quotes, uint256 start, uint256 requested, uint8 floorIndex) internal {
        uint256 count = requested;
        if (start + count > quotes.length) count = quotes.length - start;
        // launchMulti requires at least two markets; pair the final lone stock with ETH and USDG.
        if (count == 1) count = 3;

        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](count);
        for (uint256 i; i < count; ++i) {
            Currency quote = start + i < quotes.length ? quotes[start + i] : quotes[i - 1];
            uint16 bps = uint16(10_000 / count);
            if (i == count - 1) bps = uint16(10_000 - uint256(bps) * (count - 1));
            markets[i] = LaunchFactory.MarketInput({quote: quote, bps: bps});
        }

        BitmaskConfig.Modules memory m = _defaultModules();
        m.autoBurn = true;
        m.lpDonate = true;
        m.holderAirdrop = true;
        m.buybackVesting = true;
        m.buybackVestingDurationSeconds = uint32(30 days);
        m.dynamicFees = true;
        m.hookTaxBps = 400;
        // Keep the configured 4% hook pot active even at minimum dynamic depth;
        // otherwise the 1% base-only minimum leaves no funds for route modules.
        m.dynamicFeeMinTotalBps =
            ProtocolConstants.BASE_FEE_BPS + m.hookTaxBps - ProtocolConstants.MIN_DYNAMIC_FEE_TOTAL_GAP_BPS;
        m.dynamicFeeRampUp = true;
        m.dynamicFeeDepthSaturationBps = ProtocolConstants.DYNAMIC_FEE_DEFAULT_DEPTH_SATURATION_BPS;
        m.autoBurnBps = 3_334;
        m.lpDonateBps = 3_333;
        m.holderAirdropBps = 3_333;
        m.holderAirdropEpochSeconds = 60;

        vm.prank(creator);
        (uint256 launchId, address token,) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "MultiReal",
                symbol: "MREAL",
                metadataURI: "ipfs://multi-real",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0)),
                floorQuoteIndex: floorIndex,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: 0
            })
        );

        assertEq(factory.launchMarketCount(launchId), count);
        uint256 supplyBefore = IERC20(token).totalSupply();
        for (uint256 i; i < count; ++i) {
            PoolKey memory key = factory.poolKeyOfMarket(launchId, i);
            Currency quote = _quoteCurrency(key, token);
            _assertLaunchFdv(key, token, quote, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
            _routerBuy(trader, key, token, _quoteForUsd(quote, 50e18));
            assertGt(airdrops.potOf(token, quote), 0, "multi airdrop pot");
            vm.roll(block.number + 1);
        }

        assertLt(IERC20(token).totalSupply(), supplyBefore, "multi auto burn");
        (, uint128 streamed,,,) = buybacks.streams(creator, token);
        assertGt(streamed, 0, "multi vesting");
    }

    function _allQuotes() internal view returns (Currency[] memory quotes) {
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        quotes = new Currency[](stocks.length + 2);
        quotes[0] = Currency.wrap(address(0));
        quotes[1] = usdg;
        for (uint256 i; i < stocks.length; ++i) {
            quotes[i + 2] = Currency.wrap(stocks[i].token);
        }
    }

    function _supplyFor(uint256 i) internal pure returns (uint256) {
        if (i % 3 == 0) return 1_000_000e18;
        if (i % 3 == 1) return ProtocolConstants.DEFAULT_LAUNCH_SUPPLY;
        return 100_000_000_000e18;
    }

    function _quoteForUsd(Currency quote, uint256 usdX18) internal view returns (uint256 amount) {
        uint256 quoteUsdX18 = factory.quoteUsdPriceX18(Currency.unwrap(quote));
        amount = FullMath.mulDiv(usdX18, 10 ** uint256(_quoteDecimals(quote)), quoteUsdX18);
        if (amount == 0) amount = 1;
    }

    function _balanceOf(Currency currency, address account) internal view returns (uint256) {
        if (currency.isAddressZero()) return account.balance;
        return IERC20(Currency.unwrap(currency)).balanceOf(account);
    }

    function _assertLaunchFdv(PoolKey memory key, address token, Currency quote, uint256 supply) internal view {
        bool tokenIs0 = Currency.unwrap(key.currency0) == token;
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        uint256 mcapQuote = FixedPointMath.quoteFromToken(supply, sqrtPriceX96, tokenIs0);
        uint256 fdvUsdX18 = FullMath.mulDiv(
            mcapQuote, factory.quoteUsdPriceX18(Currency.unwrap(quote)), 10 ** uint256(_quoteDecimals(quote))
        );
        assertApproxEqRel(
            fdvUsdX18, ProtocolConstants.TARGET_LAUNCH_MCAP_USD_X18, 0.05e18, "initial FDV must be near $5k"
        );
    }
}
