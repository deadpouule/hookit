// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {MockQuoteToken} from "./mocks/MockQuoteToken.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {MultiPairArbExecutor} from "../src/MultiPairArbExecutor.sol";
import {Owned} from "../src/base/Owned.sol";

contract MultiPairArbTest is LaunchpadTestBase {
    MockQuoteToken internal quoteA;
    MockQuoteToken internal quoteB;
    MultiPairArbExecutor internal executor;

    function setUp() public {
        deployProtocol();
        quoteA = new MockQuoteToken("Quote A", "QTA", 18);
        quoteB = new MockQuoteToken("Quote B", "QTB", 18);
        factory.setQuote(address(quoteA), true, 18, 2_000e18, address(0));
        factory.setQuote(address(quoteB), true, 18, 3_000e18, address(0));
        executor = new MultiPairArbExecutor(manager, factory, hook, address(this));
    }

    function testHookFitsEip170() public view {
        assertLt(address(hook).code.length, 24_576);
    }

    function testArbFlagsDefaultOff() public view {
        assertEq(hook.arbExecutor(), address(0));
        assertFalse(hook.arbActive());
        assertTrue(executor.paused());
        assertEq(executor.maxClipUsdX18(), 0);
        assertEq(executor.minDeviationBps(), 1_000);
    }

    function testSetArbExecutorOnlyOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(Owned.Unauthorized.selector);
        hook.setArbExecutor(address(executor));
    }

    function testExecuteRevertsWhenPaused() public {
        vm.expectRevert(MultiPairArbExecutor.Paused.selector);
        executor.execute(1);
    }

    function testExecuteRevertsWhenClipZero() public {
        executor.setPaused(false);
        vm.expectRevert(MultiPairArbExecutor.ClipZero.selector);
        executor.execute(1);
    }

    function testExecuteRevertsWhenHookInactive() public {
        executor.setPaused(false);
        executor.setMaxClipUsdX18(100e18);
        vm.expectRevert(MultiPairArbExecutor.ArbInactive.selector);
        executor.execute(1);
    }

    function testExecuteRevertsWhenNotExecutor() public {
        executor.setPaused(false);
        executor.setMaxClipUsdX18(100e18);
        hook.setArbActive(true);
        vm.expectRevert(MultiPairArbExecutor.NotArbExecutor.selector);
        executor.execute(1);
    }

    function testExecuteRevertsNotMultiPair() public {
        (uint256 launchId,,,) = launchToken(defaultModules(), 0, 1_000_000e18);
        _armExecutor();
        vm.expectRevert(MultiPairArbExecutor.NotMultiPair.selector);
        executor.execute(launchId);
    }

    function testExecuteRevertsWhenPricesAligned() public {
        (uint256 launchId,,,) = _launchTwoQuotes(defaultModules());
        _armExecutor();
        quoteB.transfer(address(executor), 50e18);
        vm.expectRevert(MultiPairArbExecutor.DeviationTooSmall.selector);
        executor.execute(launchId);
    }

    function testPublicSwapStillPaysHookTaxWhenArbArmed() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 500;
        (uint256 launchId,,,) = _launchTwoQuotes(m);
        _armExecutor();

        PoolKey memory key0 = factory.poolKeyOfMarket(launchId, 0);
        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(quoteA)));
        uint256 protoBefore = distributor.pending(Currency.wrap(address(quoteA)));
        buyQuoteExactIn(key0, address(quoteA), 20e18);

        assertGt(escrow.balanceOf(address(this), Currency.wrap(address(quoteA))), creatorBefore);
        assertGt(distributor.pending(Currency.wrap(address(quoteA))), protoBefore);
    }

    function testArbSwapProtocolTakesFullBaseNoHookTaxAndLpStaysLocked() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 700;
        m.autoBurn = true;
        m.autoBurnBps = 10_000;
        m.creatorShareToHook = true;

        (uint256 launchId, address token,,) = _launchTwoQuotes(m);
        PoolKey memory keyA = factory.poolKeyOfMarket(launchId, 0);
        PoolId poolA = keyA.toId();

        buyQuoteExactIn(keyA, address(quoteA), 8e18);
        vm.roll(block.number + 1);

        uint256 supplyAfterSkew = LaunchTokenLike(token).totalSupply();
        uint256 burnPendingAfterSkew = hook.pendingAutoBurn(poolA);
        uint256 creatorBBefore = escrow.balanceOf(address(this), Currency.wrap(address(quoteB)));
        uint256 protoBBefore = distributor.pending(Currency.wrap(address(quoteB)));
        uint256 protoABefore = distributor.pending(Currency.wrap(address(quoteA)));

        _armExecutor();
        quoteB.transfer(address(executor), 20e18);

        MultiPairArbExecutor.Preview memory pre = executor.preview(launchId);
        assertTrue(pre.executable);
        assertEq(pre.cheapIndex, 1);
        assertEq(pre.richIndex, 0);
        assertGe(pre.deviationBps, 1_000);

        (uint256 clip, uint256 tokenSold, uint256 quoteOut) = executor.execute(launchId);
        assertGt(clip, 0);
        assertGt(tokenSold, 0);
        assertGt(quoteOut, 0);

        assertEq(LaunchTokenLike(token).totalSupply(), supplyAfterSkew);
        assertEq(hook.pendingAutoBurn(poolA), burnPendingAfterSkew);
        assertEq(escrow.balanceOf(address(this), Currency.wrap(address(quoteB))), creatorBBefore);

        uint256 protoBAfter = distributor.pending(Currency.wrap(address(quoteB)));
        uint256 protoAAfter = distributor.pending(Currency.wrap(address(quoteA)));
        assertEq(protoBAfter - protoBBefore, clip * ProtocolConstants.BASE_FEE_BPS / ProtocolConstants.BPS_DENOMINATOR);
        assertGt(protoAAfter, protoABefore);

        (,,,,, int24 tickLower, int24 tickUpper,) = factory.launches(launchId);
        vm.prank(address(manager));
        vm.expectRevert(MasterLaunchHook.LaunchPositionLocked.selector);
        hook.beforeRemoveLiquidity(
            address(factory),
            keyA,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: -1, salt: bytes32(0)}),
            ""
        );
    }

    function _armExecutor() internal {
        executor.setPaused(false);
        executor.setMaxClipUsdX18(50e18);
        hook.setArbExecutor(address(executor));
        hook.setArbActive(true);
    }

    function _launchTwoQuotes(BitmaskConfig.Modules memory modules)
        internal
        returns (uint256 launchId, address token, PoolId primary, PoolKey memory key0)
    {
        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteA)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: Currency.wrap(address(quoteB)), bps: 5_000});
        (launchId, token, primary) = factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchMultiParams({
                name: "Arb",
                symbol: "ARB",
                metadataURI: "",
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
        key0 = factory.poolKeyOfMarket(launchId, 0);
    }

    function buyQuoteExactIn(PoolKey memory key, address quote, uint256 amount) internal {
        MockQuoteToken(quote).approve(address(swapRouter), amount);
        bool quoteIs0 = Currency.unwrap(key.currency0) == quote;
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: quoteIs0,
                amountSpecified: -int256(amount),
                sqrtPriceLimitX96: quoteIs0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }
}
