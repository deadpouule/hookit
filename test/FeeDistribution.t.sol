// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BuybackVault} from "../src/BuybackVault.sol";

contract FeeDistributionTest is Test {
    FeeEscrow escrow;
    ProtocolRevenueDistributor distributor;
    FloorVault vault;
    BuybackVault buybacks;
    LaunchToken nativeToken;
    address ops = address(0xB0B);
    address creator = address(0xC0);

    function setUp() public {
        escrow = new FeeEscrow(address(this), IPoolManager(address(0)));
        vault = new FloorVault(address(this), IPoolManager(address(0)));
        distributor = new ProtocolRevenueDistributor(address(this), ops, IPoolManager(address(0)));
        buybacks = new BuybackVault(address(this), IPoolManager(address(0)));
        nativeToken = new LaunchToken("Hookit", "HOOK", 1_000_000e18, address(this), address(this), "", address(0));

        escrow.setOperator(address(this), true);
        vault.setOperator(address(this), true);
        vault.setOperator(address(distributor), true);
        distributor.setOperator(address(this), true);
        distributor.setNativeToken(address(nativeToken), vault);
        distributor.setFlywheelMode(ProtocolRevenueDistributor.FlywheelMode.DepositFloor);
        buybacks.setOperator(address(this), true);

        vm.deal(address(this), 100 ether);
        vm.deal(address(escrow), 0);
    }

    function testBitmaskRoundTrip() public pure {
        BitmaskConfig.Modules memory m = BitmaskConfig.Modules({
            antiSnipe: true,
            backedFloor: true,
            antiMev: true,
            maxTx: true,
            maxWallet: true,
            dynamicFees: true,
            buybackVesting: true,
            autoBurn: true,
            lpDonate: true,
            holderAirdrop: true,
            creatorShareToHook: false,
            hookTaxBps: 250,
            antiSnipeDurationSeconds: 3600,
            maxTxBps: 100,
            maxWalletBps: 200,
            floorAllocationBps: 2_500,
            initialSnipeTaxBps: 4_000,
            autoBurnBps: 2_500,
            lpDonateBps: 2_500,
            holderAirdropBps: 2_500,
            buybackVestingDurationSeconds: uint32(180 days),
            dynamicFeeMinTotalBps: 150,
            dynamicFeeRampUp: true,
            dynamicFeeDepthSaturationBps: 10_000,
            holderAirdropEpochSeconds: 900
        });
        uint256 packed = BitmaskConfig.pack(m);
        BitmaskConfig.Modules memory out = BitmaskConfig.unpack(packed);
        assertTrue(out.antiSnipe);
        assertTrue(out.backedFloor);
        assertTrue(out.autoBurn);
        assertTrue(out.lpDonate);
        assertTrue(out.holderAirdrop);
        assertEq(out.hookTaxBps, 250);
        assertEq(out.antiSnipeDurationSeconds, 3600);
        assertEq(out.maxTxBps, 100);
        assertEq(out.maxWalletBps, 200);
        assertEq(out.floorAllocationBps, 2_500);
        assertEq(out.initialSnipeTaxBps, 4_000);
        assertEq(out.autoBurnBps, 2_500);
        assertEq(out.lpDonateBps, 2_500);
        assertEq(out.holderAirdropBps, 2_500);
        assertEq(out.buybackVestingDurationSeconds, 180 days);
    }

    function packModules(BitmaskConfig.Modules memory m) public pure returns (uint256) {
        return BitmaskConfig.pack(m);
    }

    function testCreatorTaxCap() public {
        BitmaskConfig.Modules memory m;
        m.hookTaxBps = ProtocolConstants.MAX_HOOK_TAX_BPS + 1;
        vm.expectRevert(BitmaskConfig.HookTaxTooHigh.selector);
        this.packModules(m);
    }

    function testFeeRouteIncomplete() public {
        BitmaskConfig.Modules memory m;
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.autoBurn = true;
        m.floorAllocationBps = 4_000;
        m.autoBurnBps = 4_000;
        vm.expectRevert(BitmaskConfig.FeeRouteIncomplete.selector);
        this.packModules(m);
    }

    function testFeeRouteCap() public {
        BitmaskConfig.Modules memory m;
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.autoBurn = true;
        m.lpDonate = true;
        m.floorAllocationBps = 5_000;
        m.autoBurnBps = 4_000;
        m.lpDonateBps = 2_000;
        vm.expectRevert(BitmaskConfig.FeeRouteTooHigh.selector);
        this.packModules(m);
    }

    function testOpenFeeCap() public {
        BitmaskConfig.Modules memory m;
        m.antiSnipe = true;
        m.initialSnipeTaxBps = 9_900;
        m.hookTaxBps = 100;
        vm.expectRevert(BitmaskConfig.OpenFeeTooHigh.selector);
        this.packModules(m);
    }

    function testSnipeTaxLinearDecay() public pure {
        uint16 initial = 5_000;
        uint16 duration = 100;
        assertEq(FixedPointMath.snipeTaxBps(initial, 1_000, duration, 1_000), initial);
        assertEq(FixedPointMath.snipeTaxBps(initial, 1_000, duration, 1_050), 2_500);
        assertEq(FixedPointMath.snipeTaxBps(initial, 1_000, duration, 1_100), 0);
        assertEq(FixedPointMath.snipeTaxBps(initial, 1_000, duration, 1_200), 0);
    }

    function testSeventyThirtySplit() public {
        uint256 fee = 10 ether;
        uint256 creatorShare = FixedPointMath.applyBps(fee, ProtocolConstants.CREATOR_SHARE_BPS);
        uint256 protocolShare = fee - creatorShare;
        assertEq(creatorShare, 7 ether);
        assertEq(protocolShare, 3 ether);

        escrow.credit{value: creatorShare}(creator, Currency.wrap(address(0)), creatorShare);
        distributor.notify{value: protocolShare}(Currency.wrap(address(0)), protocolShare);

        assertEq(escrow.balanceOf(creator, Currency.wrap(address(0))), 7 ether);
        assertEq(distributor.pending(Currency.wrap(address(0))), 3 ether);
    }

    function testEightyTwentyFlywheel() public {
        distributor.notify{value: 10 ether}(Currency.wrap(address(0)), 10 ether);
        uint256 opsBefore = ops.balance;
        distributor.distribute(Currency.wrap(address(0)));
        assertEq(ops.balance - opsBefore, 2 ether);
        assertEq(vault.reserve(address(nativeToken)), 8 ether);
        assertGt(vault.floorPriceX18(address(nativeToken)), 0);
    }

    function testCreatorPullClaim() public {
        escrow.credit{value: 1 ether}(creator, Currency.wrap(address(0)), 1 ether);
        vm.prank(creator);
        escrow.claim(Currency.wrap(address(0)));
        assertEq(creator.balance, 1 ether);
        assertEq(escrow.balanceOf(creator, Currency.wrap(address(0))), 0);
    }

    function testBuybackLinearVest() public {
        address token = address(0xCAFE);
        uint256 amount = 5 ether;
        buybacks.credit{value: amount}(
            creator, token, Currency.wrap(address(0)), amount, uint64(ProtocolConstants.BUYBACK_VESTING_DURATION)
        );
        assertEq(buybacks.vestedOf(creator, token), 0);
        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION / 5);
        uint256 vested = buybacks.vestedOf(creator, token);
        assertApproxEqRel(vested, amount / 5, 1e16);
        vm.prank(creator);
        buybacks.claim(token);
        assertEq(creator.balance, vested);
    }

    function testFlushBuybackUsdgToWallet() public {
        address buybackWallet = address(0xB007);
        distributor.setFlywheelMode(ProtocolRevenueDistributor.FlywheelMode.BuybackBurn);
        distributor.setBuybackExecutor(buybackWallet);

        LaunchToken usdg = new LaunchToken("USDG", "USDG", 1_000_000e18, address(this), address(this), "", address(0));
        usdg.transfer(address(distributor), 2 ether);

        distributor.notifyBuybackInternal(Currency.wrap(address(usdg)), 2 ether);
        distributor.flushBuyback(Currency.wrap(address(usdg)));

        assertEq(usdg.balanceOf(buybackWallet), 2 ether);
        assertEq(distributor.pendingBuyback(Currency.wrap(address(usdg))), 0);
    }
}
