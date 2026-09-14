// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {FeeEscrow} from "../../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../../src/ProtocolRevenueDistributor.sol";
import {GraduatedFeeHook} from "../../src/GraduatedFeeHook.sol";
import {BondingLaunchFactory} from "../../src/BondingLaunchFactory.sol";
import {HktHolderDropVault} from "../../src/HktHolderDropVault.sol";
import {BondingConstants} from "../../src/libraries/BondingConstants.sol";
import {LaunchFactoryLib} from "../../src/libraries/LaunchFactoryLib.sol";
import {UniswapV3EthUsdTwapFeed} from "../../src/UniswapV3EthUsdTwapFeed.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../../src/libraries/FixedPointMath.sol";

import {MockQuoteToken} from "../mocks/MockQuoteToken.sol";
import {LaunchpadTestBase} from "../utils/LaunchpadTestBase.sol";
import {MockV3OraclePool, MockBalanceToken} from "../UniswapV3EthUsdTwapFeed.t.sol";

/// @notice Regression tests for the internal security review of the Classic (bonding) rail,
///         GraduatedFeeHook and the USD oracle paths (audit/INTERNAL_SECURITY_REVIEW.md, findings
///         B-*). `test_Fixed_*` assert the patched behaviour; `test_Known_*` pin documented limitations.
contract AuditBondingRouterOracleTest is Test, Deployers {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    GraduatedFeeHook internal feeHook;
    BondingLaunchFactory internal bonding;

    address internal ops = address(0xB0B);
    address internal creator = address(0xC0FFEE);
    address internal trader = address(0xBEEF);
    address internal holder = address(0x401D);
    address internal attacker = address(0xA77AC);

    Currency internal constant ETH = Currency.wrap(address(0));

    function setUp() public {
        deployFreshManagerAndRouters();
        vm.deal(address(this), 10_000 ether);
        vm.deal(creator, 100 ether);
        vm.deal(trader, 1_000 ether);
        vm.deal(holder, 100 ether);
        vm.deal(attacker, 100 ether);
        vm.deal(ops, 1 ether);

        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);

        uint160 flags =
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        address hookAddr = address(flags | (uint160(0xB0AD) << 144));
        bytes memory args = abi.encode(manager, escrow, distributor, address(this));
        deployCodeTo("GraduatedFeeHook.sol:GraduatedFeeHook", args, hookAddr);
        feeHook = GraduatedFeeHook(payable(hookAddr));

        bonding = new BondingLaunchFactory(manager, feeHook, escrow, distributor, address(this), ops);
        feeHook.setFactory(address(bonding));

        escrow.setOperator(address(bonding), true);
        escrow.setOperator(address(feeHook), true);
        distributor.setOperator(address(bonding), true);
        distributor.setOperator(address(feeHook), true);
        feeHook.setOperator(address(this), true);
    }

    // ---------------------------------------------------------------------------------------------
    // B-1 (fixed): the pool used to open ~65% below the last curve price because the virtual token
    //      reserve was the curve supply (the curve never sold out, 35% of supply landed in the LP).
    //      `BondingMath.virtualReserves` now sizes the reserves so the curve sells exactly 80% at the
    //      4.2 ETH target and the LP opens at the terminal curve price.
    // ---------------------------------------------------------------------------------------------

    function test_Fixed_B1_PoolOpensAtTerminalCurvePrice() public {
        (uint256 launchId, address token) = _launchEth(creator);

        // Bring the curve close to the 4.2 ETH target without crossing it.
        vm.prank(trader);
        bonding.buy{value: 4.2 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Bonding));

        (uint256 vq, uint256 vt) = _virtuals(launchId);
        uint256 curvePriceX18 = vq * 1e18 / vt; // quote wei per 1e18 token wei

        // Cross the threshold: this buy graduates the launch.
        vm.prank(trader);
        bonding.buy{value: 0.1 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory key = bonding.poolKeyOf(launchId);
        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        bool tokenIs0 = Currency.unwrap(key.currency0) == token;
        uint256 poolPriceX18 = FixedPointMath.quoteFromToken(1e18, sqrtP, tokenIs0);

        console.log("curve spot before graduation (wei/token):", curvePriceX18);
        console.log("pool  spot after  graduation (wei/token):", poolPriceX18);
        console.log("pool / curve (bps):", poolPriceX18 * 10_000 / curvePriceX18);

        // The last curve buy sits within ~0.05 ETH of the target, so the pool must open within a
        // few percent of the last curve price (it was ~35% before the fix).
        assertApproxEqRel(poolPriceX18, curvePriceX18, 0.03e18, "graduation price gap");
        assertGe(poolPriceX18, curvePriceX18, "pool must not open below the last curve price");
    }

    /// @dev Exactly 80% of the supply is sold on the curve and 20% + 4.2 ETH seed the LP.
    function test_Fixed_B1_CurveSellsExactlyEightyPercentAtTarget() public {
        (uint256 launchId, address token) = _launchEth(creator);
        uint256 supply = BondingConstants.TOTAL_SUPPLY;

        vm.prank(trader);
        bonding.buy{value: 10 ether}(launchId, 0, 1); // oversized: partial fill + refund
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        uint256 traderTokens = IERC20Minimal(token).balanceOf(trader);
        // Trader plus the HKT-drop curve buys (if any) hold the whole curve share.
        assertApproxEqRel(traderTokens, supply * 8_000 / 10_000, 0.01e18, "curve share");
        // Nothing left on the factory: the LP took totalSupply - tokensSold.
        assertEq(IERC20Minimal(token).balanceOf(address(bonding)), 0, "factory keeps tokens");
        assertLe(address(bonding).balance, 1, "factory keeps ETH"); // ceil rounding dust only
    }

    /// @dev The sell-before / rebuy-after round trip no longer pays: it now loses the fees.
    function test_Fixed_B1_SellBeforeGraduationRebuyAfterDoesNotProfit() public {
        (uint256 launchId, address token) = _launchEth(creator);

        vm.prank(trader);
        bonding.buy{value: 3.0 ether}(launchId, 0, 1);

        // A small late holder buys near the top of the curve.
        vm.prank(holder);
        (uint256 h0,) = bonding.buy{value: 0.2 ether}(launchId, 0, 1);

        vm.prank(trader);
        bonding.buy{value: 0.9 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Bonding));

        // Holder dumps everything on the curve right before graduation.
        vm.startPrank(holder);
        IERC20Minimal(token).approve(address(bonding), h0);
        (uint256 ethBack,) = bonding.sell(launchId, h0, 1);
        vm.stopPrank();
        console.log("holder paid 0.2 ETH, got back on curve:", ethBack);

        // Someone else graduates.
        vm.prank(trader);
        bonding.buy{value: 0.6 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        // Holder re-buys with the same ETH in the graduated pool.
        PoolKey memory key = bonding.poolKeyOf(launchId);
        vm.prank(holder);
        _poolBuy(key, token, ethBack);
        uint256 h1 = IERC20Minimal(token).balanceOf(holder);
        console.log("holder tokens before dump:", h0);
        console.log("holder tokens after rebuy:", h1);
        assertLt(h1, h0, "round trip through graduation should not gain tokens");
        // Loss is bounded by fees plus the 0.6 ETH the curve moved in between, not a 2x swing.
        assertGt(h1, h0 * 70 / 100, "round trip should only lose fees and the curve move");
    }

    // ---------------------------------------------------------------------------------------------
    // B-2 (fixed): the ERC-20 quote dev buy used to revert (launchFee > 0) or pull the quote twice
    //      (launchFee == 0) because `_executeBuy` was told it was not a launch-time buy.
    // ---------------------------------------------------------------------------------------------

    function test_Fixed_B2_Erc20DevBuyWorksWithLaunchFee() public {
        MockQuoteToken usd = new MockQuoteToken("USD", "USD", 6);
        bonding.setQuote(address(usd), true, 6, 1e18, address(0));
        bonding.setEthUsdPrice(4_000e18, address(0));
        usd.transfer(creator, 100_000e6);

        uint256 before = usd.balanceOf(creator);
        vm.startPrank(creator);
        usd.approve(address(bonding), type(uint256).max);
        (, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Dev",
                symbol: "DEV",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(usd)),
                creatorTaxBps: 0,
                devBuyQuoteIn: 100e6,
                minDevBuyTokensOut: 1
            })
        );
        vm.stopPrank();
        assertEq(before - usd.balanceOf(creator), 100e6, "dev buy pulled exactly once");
        assertGt(IERC20Minimal(token).balanceOf(creator), 0, "creator received the dev buy");
    }

    function test_Fixed_B2_Erc20DevBuyPulledOnceWhenLaunchFeeZero() public {
        MockQuoteToken usd = new MockQuoteToken("USD", "USD", 6);
        bonding.setQuote(address(usd), true, 6, 1e18, address(0));
        bonding.setEthUsdPrice(4_000e18, address(0));
        bonding.setLaunchFee(0);
        usd.transfer(creator, 100_000e6);

        uint256 devBuy = 100e6;
        uint256 before = usd.balanceOf(creator);
        vm.startPrank(creator);
        usd.approve(address(bonding), type(uint256).max);
        (uint256 launchId,) = bonding.launch(
            BondingLaunchFactory.LaunchParams({
                name: "Dev",
                symbol: "DEV",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(usd)),
                creatorTaxBps: 0,
                devBuyQuoteIn: devBuy,
                minDevBuyTokensOut: 1
            })
        );
        vm.stopPrank();

        uint256 pulled = before - usd.balanceOf(creator);
        console.log("devBuy requested:", devBuy);
        console.log("quote pulled from creator:", pulled);
        assertEq(pulled, devBuy, "creator charged once");

        // Everything pulled is accounted for: curve reserve + fees paid out, nothing stranded.
        (,,,,,,,, uint256 realQuote,,,,,,) = bonding.launches(launchId);
        assertEq(usd.balanceOf(address(bonding)), realQuote, "factory holds exactly the curve reserve");
    }

    // ---------------------------------------------------------------------------------------------
    // B-3 (fixed): GraduatedFeeHook.sweepHktDrop was permissionless with caller-chosen slippage, so a
    //      pump -> sweep(min=0) -> dump sandwich extracted most of the $HKT pot. Operator-only now.
    // ---------------------------------------------------------------------------------------------

    function test_Fixed_B3_SweepHktDropIsOperatorOnly() public {
        (PoolKey memory key, uint256 pot) = _accrueHktDropPot(5, 3 ether);
        assertGt(pot, 0);

        vm.prank(attacker);
        vm.expectRevert(GraduatedFeeHook.OnlyOperator.selector);
        feeHook.sweepHktDrop(key, 0);

        // The operator (this test) sweeps with a real minimum and the vault is credited.
        feeHook.sweepHktDrop(key, 1);
        assertEq(feeHook.pendingHktDrop(key.toId(), ETH), 0);
    }

    function _accrueHktDropPot(uint256 loops, uint256 volumePerLeg) internal returns (PoolKey memory key, uint256 pot) {
        HktHolderDropVault drop = new HktHolderDropVault(address(this));
        MockQuoteToken hkt = new MockQuoteToken("HKT", "HKT", 18);
        drop.setHkt(address(hkt));
        drop.setOperator(address(feeHook), true);
        drop.setOperator(address(bonding), true);
        feeHook.setHktDropVault(drop);
        bonding.setHktDropVault(drop);

        (uint256 launchId, address token) = _launchEth(creator);
        vm.prank(trader);
        bonding.buy{value: 4.3 ether}(launchId, 0, 1);
        assertEq(uint8(_phase(launchId)), uint8(BondingLaunchFactory.Phase.Graduated));
        key = bonding.poolKeyOf(launchId);

        // Organic volume accrues the 10% $HKT cut as ERC-6909 claims held by the hook.
        for (uint256 i; i < loops; ++i) {
            vm.startPrank(trader);
            _poolBuy(key, token, volumePerLeg);
            _poolSell(key, token, IERC20Minimal(token).balanceOf(trader));
            vm.stopPrank();
        }
        pot = feeHook.pendingHktDrop(key.toId(), ETH);
        console.log("pendingHktDrop pot (wei):", pot);
    }

    // ---------------------------------------------------------------------------------------------
    // B-5 (fixed): anyone can force the ETH/USD TWAP feed to revert by moving v3 spot > 3% in-tx,
    //      which used to fall back to the last synced snapshot forever. The fallback now expires
    //      after USD_SNAPSHOT_MAX_AGE, bounding the choice a caller has between the two prices.
    // ---------------------------------------------------------------------------------------------

    function test_Fixed_B5_SnapshotFallbackExpires() public {
        vm.warp(10_000);
        MockBalanceToken stable = new MockBalanceToken();
        MockBalanceToken weth = new MockBalanceToken();
        MockV3OraclePool pool = new MockV3OraclePool(address(stable), address(weth));
        stable.setBalance(address(pool), 500_000e6);
        weth.setBalance(address(pool), 190 ether);
        pool.setState(8e16, 198_128, 198_128, uint32(block.timestamp - 60), true);
        UniswapV3EthUsdTwapFeed feed = new UniswapV3EthUsdTwapFeed(
            pool, address(weth), address(stable), 30 minutes, 1 hours, 300, 1e16, 100 ether, 250_000e6
        );

        // Stale snapshot from an older sync ($4000); live TWAP is ~$2493.
        bonding.setEthUsdPrice(4_000e18, address(feed));
        MockQuoteToken usd = new MockQuoteToken("USD", "USD", 6);
        bonding.setQuote(address(usd), true, 6, 1e18, address(0));

        uint256 liveTarget = bonding.graduationQuoteWei(Currency.wrap(address(usd)));

        // Attacker pushes spot 301 ticks away from the TWAP in the same tx (cheap round-trip on v3).
        pool.setState(8e16, 198_128 + 301, 198_128, uint32(block.timestamp - 60), true);
        uint256 forcedTarget = bonding.graduationQuoteWei(Currency.wrap(address(usd)));

        console.log("graduation target with live feed (USD 6dp):", liveTarget);
        console.log("graduation target forced to fallback     :", forcedTarget);
        // Within the snapshot window the fallback still applies (bounded by how recent the sync is).
        assertEq(forcedTarget, 4.2e18 * 4_000 / 1e12, "fresh snapshot is used as fallback");
        assertGt(forcedTarget, liveTarget * 15 / 10);

        // Once the snapshot is older than the window, a broken feed blocks pricing instead of
        // silently serving a stale number.
        vm.warp(block.timestamp + ProtocolConstants.USD_SNAPSHOT_MAX_AGE + 1);
        vm.expectRevert(BondingLaunchFactory.StalePrice.selector);
        bonding.graduationQuoteWei(Currency.wrap(address(usd)));

        // A fresh snapshot (owner sync or a healthy feed) restores pricing.
        bonding.setEthUsdPrice(2_493e18, address(feed));
        assertApproxEqRel(bonding.graduationQuoteWei(Currency.wrap(address(usd))), liveTarget, 1e16);
    }

    // ---------------------------------------------------------------------------------------------
    // B-4 (fixed): the Quotrons wStock spot price (thin pool, movable inside the launch tx) was the
    //      USD oracle for wStock-quoted launches. The live spot is now only trusted inside a band
    //      around the listing snapshot; outside it the snapshot wins.
    // ---------------------------------------------------------------------------------------------

    function test_Fixed_B4_QuotronSpotOnlyTrustedInsideBand() public pure {
        uint256 snapshot = 300e18;
        uint256 bandBps = ProtocolConstants.QUOTRON_SPOT_MAX_DEVIATION_BPS;
        uint256 band = snapshot * bandBps / ProtocolConstants.BPS_DENOMINATOR;

        assertTrue(LaunchFactoryLib.spotWithinBand(snapshot, snapshot));
        assertTrue(LaunchFactoryLib.spotWithinBand(snapshot + band, snapshot));
        assertTrue(LaunchFactoryLib.spotWithinBand(snapshot - band, snapshot));
        assertFalse(LaunchFactoryLib.spotWithinBand(snapshot + band + 1, snapshot), "pumped spot rejected");
        assertFalse(LaunchFactoryLib.spotWithinBand(snapshot - band - 1, snapshot), "dumped spot rejected");
        assertFalse(LaunchFactoryLib.spotWithinBand(snapshot * 3, snapshot), "3x swing rejected");
        // No snapshot to compare against: the live price is the only source.
        assertTrue(LaunchFactoryLib.spotWithinBand(snapshot * 3, 0));
    }

    // ---------------------------------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------------------------------

    function _launchEth(address who) internal returns (uint256 launchId, address token) {
        vm.prank(who);
        (launchId, token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: ETH,
                creatorTaxBps: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function _poolBuy(PoolKey memory key, address token, uint256 ethIn) internal {
        bool zeroForOne = Currency.unwrap(key.currency1) == token;
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(ethIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _poolSell(PoolKey memory key, address token, uint256 tokenIn) internal {
        bool zeroForOne = Currency.unwrap(key.currency0) == token;
        IERC20Minimal(token).approve(address(swapRouter), tokenIn);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(tokenIn),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _phase(uint256 launchId) internal view returns (BondingLaunchFactory.Phase) {
        (,,, BondingLaunchFactory.Phase phase,,,,,,,,,,,) = bonding.launches(launchId);
        return phase;
    }

    function _virtuals(uint256 launchId) internal view returns (uint256 vq, uint256 vt) {
        (,,,,,,,,, vq, vt,,,,) = bonding.launches(launchId);
    }
}
