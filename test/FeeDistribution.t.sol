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
        nativeToken = new LaunchToken("Hookit", "HOOK", 1_000_000e18, address(this), address(this), "");

        escrow.setOperator(address(this), true);
        vault.setOperator(address(this), true);
        vault.setOperator(address(distributor), true);
        distributor.setOperator(address(this), true);
        distributor.setNativeToken(address(nativeToken), vault);
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
            creatorTaxBps: 250,
            antiSnipeDurationSeconds: 3600,
            maxTxBps: 100,
            maxWalletBps: 200,
            floorAllocationBps: 1_500,
            initialSnipeTaxBps: 4_000
        });
        uint256 packed = BitmaskConfig.pack(m);
        BitmaskConfig.Modules memory out = BitmaskConfig.unpack(packed);
        assertTrue(out.antiSnipe);
        assertTrue(out.backedFloor);
        assertEq(out.creatorTaxBps, 250);
        assertEq(out.antiSnipeDurationSeconds, 3600);
        assertEq(out.maxTxBps, 100);
        assertEq(out.maxWalletBps, 200);
        assertEq(out.floorAllocationBps, 1_500);
        assertEq(out.initialSnipeTaxBps, 4_000);
    }

    function packModules(BitmaskConfig.Modules memory m) public pure returns (uint256) {
        return BitmaskConfig.pack(m);
    }

    function testCreatorTaxCap() public {
        BitmaskConfig.Modules memory m;
        m.creatorTaxBps = ProtocolConstants.MAX_CREATOR_TAX_BPS + 1;
        vm.expectRevert(BitmaskConfig.CreatorTaxTooHigh.selector);
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
        uint256 amount = 5 ether;
        buybacks.credit{value: amount}(creator, Currency.wrap(address(0)), amount);
        assertEq(buybacks.vestedOf(creator, Currency.wrap(address(0))), 0);
        vm.warp(block.timestamp + ProtocolConstants.BUYBACK_VESTING_DURATION / 5);
        uint256 vested = buybacks.vestedOf(creator, Currency.wrap(address(0)));
        assertApproxEqRel(vested, amount / 5, 1e16);
        vm.prank(creator);
        buybacks.claim(Currency.wrap(address(0)));
        assertEq(creator.balance, vested);
    }
}
