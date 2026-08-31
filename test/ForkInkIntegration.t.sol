// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {IMasterLaunchHook} from "../src/interfaces/IMasterLaunchHook.sol";

/// @notice End-to-end Ink mainnet fork integration: launches, swaps, fees, modules.
contract ForkInkIntegrationTest is InkForkTestBase {
    using StateLibrary for IPoolManager;

    // ─── Infrastructure ───────────────────────────────────────────────────────

    function testFork_InkPoolManagerLive() public onlyFork {
        assertGt(address(manager).code.length, 0);
        assertTrue(factory.isQuoteAllowed(Currency.unwrap(usdg)));
        assertTrue(factory.isQuoteAllowed(Currency.unwrap(wspyx)));
    }

    // ─── Launches: quote assets & tick spacing ───────────────────────────────

    function testFork_LaunchEthQuote_BuyAndSell() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "InkETH",
            "IETH"
        );

        _routerBuy(trader, l.key, l.token, 0.25 ether);
        uint256 tokens = _tokenBalance(l.token, trader);
        assertGt(tokens, 0);

        _routerSell(trader, l.key, l.token, tokens / 4);
        assertGt(_tokenBalance(l.token, trader), tokens / 2);
    }

    function testFork_LaunchUsdgQuote_BuyAndSell() public onlyFork {
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, usdg, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "InkUSDG", "IUSD");

        _routerBuy(trader, l.key, l.token, 1_000e6);
        uint256 tokens = _tokenBalance(l.token, trader);
        assertGt(tokens, 0);

        _routerSell(trader, l.key, l.token, tokens / 5);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(trader), 0);
    }

    function testFork_LaunchWspyxQuote_BuyAndSell() public onlyFork {
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, wspyx, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "InkSPY", "ISPY");

        _routerBuy(trader, l.key, l.token, 0.05e18);
        uint256 tokens = _tokenBalance(l.token, trader);
        assertGt(tokens, 0);

        _routerSell(trader, l.key, l.token, tokens / 5);
        assertGt(IERC20(Currency.unwrap(wspyx)).balanceOf(trader), 0);
    }

    function testFork_LaunchTickSpacing10() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            10,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Tick10",
            "T10"
        );
        assertEq(l.key.tickSpacing, 10);
        _routerBuy(trader, l.key, l.token, 0.1 ether);
        assertGt(_tokenBalance(l.token, trader), 0);
    }

    function testFork_LaunchTickSpacing60() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Tick60",
            "T60"
        );
        assertEq(l.key.tickSpacing, 60);
        _routerBuy(trader, l.key, l.token, 0.1 ether);
        assertGt(_tokenBalance(l.token, trader), 0);
    }

    function testFork_MultipleLaunches_Isolated() public onlyFork {
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
            _launch(creator, usdg, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "B", "BBB");

        assertTrue(a.token != b.token);
        assertTrue(PoolId.unwrap(a.poolId) != PoolId.unwrap(b.poolId));

        _routerBuy(trader, a.key, a.token, 0.1 ether);
        _routerBuy(trader, b.key, b.token, 500e6);
        assertGt(_tokenBalance(a.token, trader), 0);
        assertGt(_tokenBalance(b.token, trader), 0);
    }

    // ─── LP lock ─────────────────────────────────────────────────────────────

    function testFork_LaunchLiquidityCannotBeRemoved() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Lock",
            "LCK"
        );
        IMasterLaunchHook.LaunchState memory st = hook.launchState(l.poolId);

        vm.prank(address(manager));
        vm.expectRevert(MasterLaunchHook.LaunchPositionLocked.selector);
        hook.beforeRemoveLiquidity(
            address(factory),
            l.key,
            ModifyLiquidityParams({
                tickLower: st.tickLower, tickUpper: st.tickUpper, liquidityDelta: -1, salt: bytes32(0)
            }),
            ""
        );
    }

    // ─── Fee routing: creator + protocol ─────────────────────────────────────

    function testFork_CreatorClaimsFees_EthQuote() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 100;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Fees", "FEE");
        Currency quote = Currency.wrap(address(0));

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        _routerBuy(trader, l.key, l.token, 2 ether);
        assertGt(escrow.balanceOf(creator, quote), escrowBefore);

        uint256 balBefore = creator.balance;
        _claimCreatorFees(creator, quote);
        assertGt(creator.balance, balBefore);
        assertEq(escrow.balanceOf(creator, quote), 0);
    }

    function testFork_ProtocolFees_Distribute8020() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Proto",
            "PRO"
        );
        Currency quote = Currency.wrap(address(0));

        _routerBuy(trader, l.key, l.token, 3 ether);
        uint256 pending = distributor.pending(quote);
        assertGt(pending, 0);

        uint256 opsBefore = ops.balance;
        uint256 buybackBefore = distributor.buybackEth();
        _distributeProtocol(quote);

        assertGt(ops.balance, opsBefore);
        assertGt(distributor.buybackEth(), buybackBefore);
        assertEq(distributor.pending(quote), 0);

        uint256 opsReceived = ops.balance - opsBefore;
        uint256 buybackReceived = distributor.buybackEth() - buybackBefore;
        assertApproxEqRel(opsReceived, FixedPointMath.applyBps(pending, ProtocolConstants.OPS_SHARE_BPS), 0.02e18);
        assertApproxEqRel(buybackReceived, pending - opsReceived, 0.02e18);
    }

    function testFork_HookTaxGoesToProtocol_NotCreator() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 500; // 5% — no modules → unallocated hook tax to protocol
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Tax", "TAX");
        Currency quote = Currency.wrap(address(0));

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        uint256 protoBefore = distributor.pending(quote);
        _routerBuy(trader, l.key, l.token, 1 ether);

        uint256 escrowDelta = escrow.balanceOf(creator, quote) - escrowBefore;
        uint256 protoDelta = distributor.pending(quote) - protoBefore;
        // Creator only gets 70% of the 1% base; hook tax tips protocol above creator.
        assertGt(escrowDelta, 0);
        assertGt(protoDelta, escrowDelta);
    }

    function testFork_UsdgQuote_FeesAccrueInUsdg() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 50;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, usdg, m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "UFee", "UFE");

        uint256 escrowBefore = escrow.balanceOf(creator, usdg);
        _routerBuy(trader, l.key, l.token, 2_000e6);
        assertGt(escrow.balanceOf(creator, usdg), escrowBefore);
        assertGt(distributor.pending(usdg), 0);

        uint256 usdgBefore = IERC20(Currency.unwrap(usdg)).balanceOf(creator);
        _claimCreatorFees(creator, usdg);
        assertGt(IERC20(Currency.unwrap(usdg)).balanceOf(creator), usdgBefore);
    }

    // ─── Floor allocation ────────────────────────────────────────────────────

    function testFork_FloorAllocation_DepositsToTokenVault() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 200; // 2% hook tax pot
        m.backedFloor = true;
        m.floorAllocationBps = 2_000; // 20% of hook tax pot
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Floor", "FLR");

        uint256 reserveBefore = vault.reserve(l.token);
        _routerBuy(trader, l.key, l.token, 1.5 ether);
        assertGt(vault.reserve(l.token), reserveBefore);
    }

    // ─── Modules: anti-snipe, auto-burn, LP donate, anti-MEV ─────────────────

    function testFork_AntiSnipe_HigherFeesAtLaunch() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 1_000;
        m.initialSnipeTaxBps = 5_000;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Snipe", "SNP");
        Currency quote = Currency.wrap(address(0));

        _routerBuy(trader, l.key, l.token, 0.5 ether);
        uint256 feesEarly = escrow.balanceOf(creator, quote) + distributor.pending(quote);

        vm.warp(block.timestamp + 1_001);
        uint256 escrowMid = escrow.balanceOf(creator, quote);
        uint256 protoMid = distributor.pending(quote);
        _routerBuy(trader, l.key, l.token, 0.5 ether);
        uint256 feesLate = (escrow.balanceOf(creator, quote) - escrowMid) + (distributor.pending(quote) - protoMid);

        assertGt(feesEarly, feesLate);
    }

    function testFork_AutoBurn_ReducesSupply() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 300;
        m.autoBurn = true;
        m.autoBurnBps = 3_000;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Burn", "BRN");

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        _routerBuy(trader, l.key, l.token, 2 ether);
        assertLt(IERC20(l.token).totalSupply(), supplyBefore);
        assertEq(hook.pendingAutoBurn(l.poolId), 0);
    }

    function testFork_LpDonate_IncreasesFeeGrowth() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 300;
        m.lpDonate = true;
        m.lpDonateBps = 4_000;
        InkForkTestBase.LaunchResult memory l = _launch(
            creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Donate", "DON"
        );

        (uint256 g0Before, uint256 g1Before) = manager.getFeeGrowthGlobals(l.poolId);
        _routerBuy(trader, l.key, l.token, 1 ether);
        (uint256 g0After, uint256 g1After) = manager.getFeeGrowthGlobals(l.poolId);
        assertTrue(g0After > g0Before || g1After > g1Before);
        assertEq(hook.pendingLpDonate(l.poolId), 0);
    }

    function testFork_AutoBurnAndLpDonate_Combined() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 300;
        m.autoBurn = true;
        m.lpDonate = true;
        m.autoBurnBps = 1_500;
        m.lpDonateBps = 1_500;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Combo", "CMB");

        uint256 supplyBefore = IERC20(l.token).totalSupply();
        uint256 escrowBefore = escrow.balanceOf(creator, Currency.wrap(address(0)));
        _routerBuy(trader, l.key, l.token, 2 ether);

        assertLt(IERC20(l.token).totalSupply(), supplyBefore);
        assertGt(escrow.balanceOf(creator, Currency.wrap(address(0))), escrowBefore);
    }

    function testFork_AntiMev_BlocksSameBlockRoundTrip() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.antiMev = true;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "MEV", "MEV");

        _routerBuy(trader, l.key, l.token, 0.5 ether);
        uint256 bal = _tokenBalance(l.token, trader);

        vm.startPrank(trader);
        IERC20(l.token).approve(address(router), bal);
        bool zeroForOne = !_buyZeroForOne(l.key, l.token);
        vm.expectRevert();
        router.swapExactIn(l.key, zeroForOne, bal / 10, 1, TickMath.MAX_SQRT_PRICE - 1);
        vm.stopPrank();
    }

    function testFork_AntiMev_AllowsSellNextBlock() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.antiMev = true;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "MEV2", "MV2");

        _routerBuy(trader, l.key, l.token, 0.5 ether);
        vm.roll(block.number + 1);
        uint256 bal = _tokenBalance(l.token, trader);
        _routerSell(trader, l.key, l.token, bal / 10);
    }

    // ─── Sell path fees ───────────────────────────────────────────────────────

    function testFork_SellAccruesFeesToCreator() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = 100;
        InkForkTestBase.LaunchResult memory l =
            _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Sell", "SEL");
        Currency quote = Currency.wrap(address(0));

        _routerBuy(trader, l.key, l.token, 1 ether);
        vm.roll(block.number + 1);
        uint256 tokens = _tokenBalance(l.token, trader);

        uint256 escrowBefore = escrow.balanceOf(creator, quote);
        _routerSell(trader, l.key, l.token, tokens / 5);
        assertGt(escrow.balanceOf(creator, quote), escrowBefore);
    }

    // ─── FDV sanity ─────────────────────────────────────────────────────────

    function testFork_LaunchMcapNearFourThousandUsd_Eth() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Mcap",
            "MCP"
        );
        bool tokenIs0 = Currency.unwrap(l.key.currency0) == l.token;
        (uint160 sqrtPriceX96,,,) = manager.getSlot0(l.poolId);
        uint256 mcapQuote =
            FixedPointMath.quoteFromToken(ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, sqrtPriceX96, tokenIs0);
        uint256 expected = factory.mcapQuoteFor(address(0));
        assertApproxEqRel(mcapQuote, expected, 0.05e18);
    }
}
