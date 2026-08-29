// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {TokenAddressMiner} from "../src/libraries/TokenAddressMiner.sol";

contract LaunchMultiTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    MockQuoteToken internal quoteA;
    MockQuoteToken internal quoteB;

    function setUp() public {
        deployProtocol();
        quoteA = new MockQuoteToken("Quote A", "QTA", 18);
        quoteB = new MockQuoteToken("Quote B", "QTB", 18);
        factory.setQuote(address(quoteA), true, 18, 2_000e18, address(0));
        factory.setQuote(address(quoteB), true, 18, 3_000e18, address(0));
    }

    function testLaunchMulti_EthAndErc20() public {
        uint256 supply = ProtocolConstants.DEFAULT_LAUNCH_SUPPLY;
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 6_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 4_000});

        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 300;
        m.initialSnipeTaxBps = 1_000;

        (uint256 launchId, address token, PoolId primary) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Multi",
                symbol: "MLT",
                metadataURI: "ipfs://multi",
                totalSupply: supply,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );

        assertEq(launchId, 1);
        assertEq(factory.launchMarketCount(launchId), 2);
        assertEq(factory.launchFloorQuoteIndex(launchId), 0);
        assertEq(PoolId.unwrap(primary), PoolId.unwrap(_launchPoolId(launchId)));

        LaunchFactory.LaunchMarket memory m0 = _market(launchId, 0);
        LaunchFactory.LaunchMarket memory m1 = _market(launchId, 1);
        assertEq(m0.bps, 6_000);
        assertEq(m1.bps, 4_000);
        assertGt(m0.liquidity, 0);
        assertGt(m1.liquidity, 0);

        uint256 ethSlice = supply * 6_000 / 10_000;
        uint256 ercSlice = supply - ethSlice;
        assertLt(LaunchTokenLike(token).balanceOf(address(factory)), 1e15);

        PoolKey memory key0 = factory.poolKeyOfMarket(launchId, 0);
        PoolKey memory key1 = factory.poolKeyOfMarket(launchId, 1);
        assertEq(factory.poolLaunchId(key0.toId()), launchId);
        assertEq(factory.poolMarketIndex(key1.toId()), 1);

        buyExactIn(key0, 0.01 ether);
        vm.roll(block.number + 1);

        quoteA.approve(address(swapRouter), type(uint256).max);
        bool quoteIsCurrency0 = Currency.unwrap(key1.currency0) == address(quoteA);
        swapRouter.swap(
            key1,
            SwapParams({
                zeroForOne: quoteIsCurrency0,
                amountSpecified: -int256(10e18),
                sqrtPriceLimitX96: quoteIsCurrency0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );

        assertGt(LaunchTokenLike(token).balanceOf(address(this)), 0);
        ethSlice;
        ercSlice;
    }

    function testLaunchMulti_TokenAddressEndsWithBrandNibble() public {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](1);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 10_000});

        (, address token,) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Brand",
                symbol: "BR8",
                metadataURI: "ipfs://brand",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                markets: markets,
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                bitmask: BitmaskConfig.pack(defaultModules()),
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );
        assertTrue(TokenAddressMiner.hasBrandSuffix(token));
    }

    function testLaunchMulti_RevertsDuplicateQuote() public {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 5_000});

        vm.expectRevert(LaunchFactory.DuplicateQuote.selector);
        factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Dup",
                symbol: "DUP",
                metadataURI: "",
                totalSupply: 1e18,
                markets: markets,
                tickSpacing: 60,
                bitmask: 0,
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );
    }

    function testLaunchMulti_RevertsInvalidBps() public {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 4_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 4_000});

        vm.expectRevert(LaunchFactory.InvalidMarketBps.selector);
        factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Bps",
                symbol: "BPS",
                metadataURI: "",
                totalSupply: 1e18,
                markets: markets,
                tickSpacing: 60,
                bitmask: 0,
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );
    }

    function testLaunchMulti_RevertsBackedFloor() public {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 5_000});

        BitmaskConfig.Modules memory mods = defaultModules();
        mods.backedFloor = true;

        vm.expectRevert(LaunchFactory.FloorNotSupportedInMulti.selector);
        factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Floor",
                symbol: "FLR",
                metadataURI: "",
                totalSupply: 1e18,
                markets: markets,
                tickSpacing: 60,
                bitmask: BitmaskConfig.pack(mods),
                customHook: IHooks(address(0)),
                floorQuoteIndex: 0
            })
        );
    }

    function testLaunchMulti_ThreeMarketsSupplySplit() public {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](3);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(0)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 3_000});
        markets[2] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteB)), bps: 2_000});

        uint256 supply = 1_000_000e18;
        (uint256 launchId,,) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Tri",
                symbol: "TRI",
                metadataURI: "",
                totalSupply: supply,
                markets: markets,
                tickSpacing: 60,
                bitmask: 0,
                customHook: IHooks(address(0)),
                floorQuoteIndex: 1
            })
        );

        assertEq(factory.launchMarketCount(launchId), 3);
        assertEq(_market(launchId, 0).bps, 5_000);
        assertEq(_market(launchId, 1).bps, 3_000);
        assertEq(_market(launchId, 2).bps, 2_000);

        uint256 expected0 = supply * 5_000 / 10_000;
        uint256 expected1 = supply * 3_000 / 10_000;
        uint256 expected2 = supply - expected0 - expected1;
        assertEq(expected0 + expected1 + expected2, supply);
    }

    function _launchPoolId(uint256 launchId) internal view returns (PoolId poolId) {
        (,,,, poolId,,,) = factory.launches(launchId);
    }

    function _market(uint256 launchId, uint256 index)
        internal
        view
        returns (LaunchFactory.LaunchMarket memory market)
    {
        (Currency quote, uint16 bps, PoolId poolId, int24 tickLower, int24 tickUpper, uint128 liquidity) =
            factory.launchMarkets(launchId, index);
        market = LaunchFactory.LaunchMarket({
            quote: quote,
            bps: bps,
            poolId: poolId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity
        });
    }
}
