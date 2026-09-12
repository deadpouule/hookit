// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {HktHolderDropVault} from "../src/HktHolderDropVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

contract HktHolderDropTest is LaunchpadTestBase {
    HktHolderDropVault internal drop;
    LaunchToken internal hkt;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B2);

    function setUp() public {
        deployProtocol();
        drop = new HktHolderDropVault(address(this));
        hkt = new LaunchToken("Hookit", "HKT", 1_000_000e18, address(this), address(this), "", address(drop));
        drop.setHkt(address(hkt));
        drop.setOperator(address(this), true);
        drop.setOperator(address(hook), true);
        hook.setHktDropVault(drop);
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
    }

    function testSplitConstantsSumToBps() public pure {
        assertEq(
            uint256(ProtocolConstants.CREATOR_SHARE_BPS) + uint256(ProtocolConstants.HKT_HOLDER_SHARE_BPS)
                + uint256(ProtocolConstants.PROTOCOL_SHARE_BPS),
            ProtocolConstants.BPS_DENOMINATOR
        );
        (uint256 c, uint256 h, uint256 p) = ProtocolConstants.splitBaseFee(10 ether);
        assertEq(c, 6 ether);
        assertEq(h, 1 ether);
        assertEq(p, 3 ether);
    }

    function testPushProRataToLiveHktHolders() public {
        hkt.transfer(alice, 750_000e18);
        hkt.transfer(bob, 250_000e18);

        LaunchToken meme = new LaunchToken("Meme", "MEME", 100e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 100e18);
        drop.creditInternal(address(meme), 100e18);

        assertTrue(drop.tryPush(address(meme)));
        assertEq(meme.balanceOf(alice), 75e18);
        assertEq(meme.balanceOf(bob), 25e18);
        assertEq(drop.potOf(address(meme)), 0);
    }

    function testMoreHktReceivesMoreLaunchedToken() public {
        hkt.transfer(alice, 900_000e18);
        hkt.transfer(bob, 100_000e18);

        LaunchToken meme = new LaunchToken("Meme", "MEME", 1_000e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 1_000e18);
        drop.creditInternal(address(meme), 1_000e18);

        drop.tryPush(address(meme));
        assertEq(meme.balanceOf(alice), 900e18);
        assertEq(meme.balanceOf(bob), 100e18);
        assertGt(meme.balanceOf(alice), meme.balanceOf(bob));
    }

    function testLiveBalanceUsedAtPayout() public {
        hkt.transfer(alice, 800_000e18);
        hkt.transfer(bob, 200_000e18);

        LaunchToken meme = new LaunchToken("Meme", "MEME", 100e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 100e18);
        drop.creditInternal(address(meme), 100e18);

        vm.prank(alice);
        hkt.transfer(bob, 800_000e18);

        drop.tryPush(address(meme));
        assertEq(meme.balanceOf(alice), 0);
        assertEq(meme.balanceOf(bob), 100e18);
    }

    function testEpochGatesSecondPush() public {
        hkt.transfer(alice, 1_000_000e18);
        LaunchToken meme = new LaunchToken("Meme", "MEME", 20e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 10e18);
        drop.creditInternal(address(meme), 10e18);
        assertTrue(drop.tryPush(address(meme)));

        meme.transfer(address(drop), 10e18);
        drop.creditInternal(address(meme), 10e18);
        assertFalse(drop.tryPush(address(meme)));

        vm.warp(block.timestamp + drop.epochSeconds());
        assertTrue(drop.tryPush(address(meme)));
        assertEq(meme.balanceOf(alice), 20e18);
    }

    function testUnsetVaultFallsBackToProtocol() public {
        hook.setHktDropVault(HktHolderDropVault(address(0)));
        BitmaskConfig.Modules memory m = defaultModules();
        (,,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 10 ether);
        uint256 baseFee = 10 ether * uint256(ProtocolConstants.BASE_FEE_BPS) / ProtocolConstants.BPS_DENOMINATOR;
        uint256 creator = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        uint256 proto = distributor.pending(Currency.wrap(address(0)));
        assertApproxEqRel(creator, baseFee * 60 / 100, 0.03e18);
        assertApproxEqRel(creator + proto, baseFee, 0.03e18);
        assertGt(proto, creator / 2);
    }

    function testMasterSwapBuysLaunchedTokenForHktHolders() public {
        hkt.transfer(alice, 600_000e18);
        hkt.transfer(bob, 400_000e18);

        BitmaskConfig.Modules memory m = defaultModules();
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 10 ether);
        uint256 pot = drop.potOf(token);
        assertGt(pot, 0, "10% of base should buy launched token into the vault");
        assertEq(LaunchTokenLike(token).balanceOf(address(drop)), pot);

        uint256 aliceBefore = LaunchTokenLike(token).balanceOf(alice);
        uint256 bobBefore = LaunchTokenLike(token).balanceOf(bob);
        vm.warp(block.timestamp + drop.epochSeconds());
        assertTrue(drop.tryPush(token));

        uint256 aliceGot = LaunchTokenLike(token).balanceOf(alice) - aliceBefore;
        uint256 bobGot = LaunchTokenLike(token).balanceOf(bob) - bobBefore;
        assertGt(aliceGot, bobGot, "larger $HKT balance receives more launched token");
        assertApproxEqRel(aliceGot * 2, bobGot * 3, 0.05e18);
    }
}
