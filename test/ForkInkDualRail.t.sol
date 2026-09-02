// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {ModuleMatrix} from "./utils/ModuleMatrix.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {EthUsdgBridgeSeeder} from "../src/EthUsdgBridgeSeeder.sol";

/// @notice Ink fork: Master + Classic rails coexist; shared escrow/distributor; fee rail smoke.
contract ForkInkDualRailTest is InkForkTestBase {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    function testFork_DualRail_MasterAndBonding_SameProtocol() public onlyFork {
        // Master kitchen sink on ETH.
        BitmaskConfig.Modules memory m = ModuleMatrix.kitchenSink();
        InkForkTestBase.LaunchResult memory master = _launch(
            creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Master", "MST"
        );
        uint256 buyIn = _smokeBuyAmountForQuote(m, Currency.wrap(address(0)));
        _routerBuy(trader, master.key, master.token, buyIn);
        if (m.maxTx && m.backedFloor) {
            vm.roll(block.number + 1);
            _routerBuy(trader, master.key, master.token, buyIn);
        }
        assertGt(_tokenBalance(master.token, trader), 0);
        assertGt(vault.reserve(master.token), 0);

        // Classic bonding → graduate on ETH.
        BondingResult memory classic = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "Bond", "BND");
        _bondingBuyToGraduate(trader, classic.launchId, classic.quote);
        assertEq(uint8(_bondingPhase(classic.launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        PoolKey memory gKey = bonding.poolKeyOf(classic.launchId);
        _routerBuy(trader, gKey, classic.token, 0.05 ether);
        assertGt(_tokenBalance(classic.token, trader), 0);

        // Classic post-grad protocol fees: sweep → distribute 20% ops / 80% buybackEth.
        PoolId poolId = gKey.toId();
        graduatedHook.sweepQuote(poolId);
        Currency eth = Currency.wrap(address(0));
        uint256 pending = distributor.pending(eth);
        if (pending > 0) {
            uint256 opsBefore = ops.balance;
            uint256 buybackBefore = distributor.buybackEth();
            distributor.distribute(eth);
            uint256 opsReceived = ops.balance - opsBefore;
            uint256 buybackReceived = distributor.buybackEth() - buybackBefore;
            assertApproxEqRel(opsReceived, FixedPointMath.applyBps(pending, ProtocolConstants.OPS_SHARE_BPS), 0.02e18);
            assertApproxEqRel(buybackReceived, pending - opsReceived, 0.02e18);
        }

        // Protocol fee sinks shared.
        (, uint128 streamed,,,) = buybacks.streams(creator, master.token);
        assertTrue(escrow.balanceOf(creator, Currency.wrap(address(0))) > 0 || streamed > 0);
    }

    function testFork_DualRail_MasterUsdg_BondingUsdg() public onlyFork {
        InkForkTestBase.LaunchResult memory master =
            _launch(creator, usdg, _defaultModules(), 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "MU", "MU");
        _routerBuy(trader, master.key, master.token, 1_000e6);

        BondingResult memory classic = _bondingLaunch(creator, usdg, 0, "BU", "BU");
        _bondingBuyToGraduate(trader, classic.launchId, usdg);
        assertEq(uint8(_bondingPhase(classic.launchId)), uint8(BondingLaunchFactory.Phase.Graduated));

        _routerBuy(trader, bonding.poolKeyOf(classic.launchId), classic.token, 100e6);
        assertGt(_tokenBalance(classic.token, trader), 0);
    }

    function testFork_DualRail_FeeCap_BothRails() public onlyFork {
        BitmaskConfig.Modules memory m = _defaultModules();
        m.hookTaxBps = ProtocolConstants.MAX_HOOK_TAX_BPS;
        BitmaskConfig.pack(m);
        _launch(creator, Currency.wrap(address(0)), m, 60, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY, "Cap", "CAP");

        // Classic: any creator tax reverts (base 1% only).
        vm.prank(creator);
        vm.expectRevert(BondingLaunchFactory.CreatorTaxTooHigh.selector);
        bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "CapB",
                symbol: "CAPB",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 1,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }

    function testFork_DualRail_FeeRail_WithBondingGraduated() public onlyFork {
        FeeEthRail feeRail = new FeeEthRail(deployer, manager, Currency.unwrap(usdg));
        distributor.setFeeRail(feeRail);
        EthUsdgBridgeLib.initializeEmpty(manager, Currency.unwrap(usdg));
        EthUsdgBridgeLib.wireLive(manager, feeRail, EthUsdgBridgeLib.poolKey(Currency.unwrap(usdg)), address(0));
        EthUsdgBridgeSeeder seeder = new EthUsdgBridgeSeeder(manager);

        deal(Currency.unwrap(usdg), address(this), 2_000_000e6);
        IERC20(Currency.unwrap(usdg)).approve(address(seeder), type(uint256).max);
        seeder.seed{value: 20 ether}(Currency.unwrap(usdg), 2_000_000e6, -600, 600, 1e18);

        BondingResult memory classic = _bondingLaunch(creator, Currency.wrap(address(0)), 0, "Rail", "RAIL");
        _bondingBuyToGraduate(trader, classic.launchId, classic.quote);

        // Protocol pending from bonding curve fees should be distributable as ETH path exists.
        if (distributor.pending(Currency.wrap(address(0))) > 0) {
            uint256 opsBefore = ops.balance;
            distributor.distribute(Currency.wrap(address(0)));
            assertGt(ops.balance, opsBefore);
        }
    }
}
