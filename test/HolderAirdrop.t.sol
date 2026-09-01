// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";

contract HolderAirdropTest is LaunchpadTestBase {
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B2);

    function setUp() public {
        deployProtocol();
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
    }

    function testHolderAirdropAccumulatesAndDistributesProRata() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000; // 100% of hook tax pot

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        _buyAs(alice, key, 1 ether);
        _buyAs(bob, key, 3 ether);

        uint256 pot = airdrops.reserve(token);
        assertGt(pot, 0, "fees should accrue to airdrop vault");

        uint256 aliceBal = LaunchTokenLike(token).balanceOf(alice);
        uint256 bobBal = LaunchTokenLike(token).balanceOf(bob);
        assertGt(aliceBal, 0);
        assertGt(bobBal, 0);

        address[] memory holders = _circulatingHolders(token, alice, bob);

        uint256 aliceEthBefore = alice.balance;
        uint256 bobEthBefore = bob.balance;

        uint256 distributed = airdrops.airdrop(token, holders);
        assertGt(distributed, 0);
        assertEq(airdrops.lastAirdropAt(token), uint64(block.timestamp));

        uint256 aliceGot = alice.balance - aliceEthBefore;
        uint256 bobGot = bob.balance - bobEthBefore;
        assertGt(aliceGot, 0);
        assertGt(bobGot, 0);
        // Pro-rata within 1%: aliceGot/aliceBal ≈ bobGot/bobBal
        assertApproxEqRel(aliceGot * bobBal, bobGot * aliceBal, 0.01e18);

        vm.expectRevert(HolderAirdropVault.EpochNotElapsed.selector);
        airdrops.airdrop(token, holders);

        vm.warp(block.timestamp + ProtocolConstants.HOLDER_AIRDROP_EPOCH);
        _buyAs(alice, key, 0.5 ether);
        if (airdrops.reserve(token) > 0) {
            holders = _circulatingHolders(token, alice, bob);
            airdrops.airdrop(token, holders);
        }
    }

    function testIncompleteHolderSetReverts() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        _buyAs(alice, key, 1 ether);
        _buyAs(bob, key, 1 ether);
        assertGt(airdrops.reserve(token), 0);

        address[] memory onlyAlice = new address[](1);
        onlyAlice[0] = alice;
        vm.expectRevert(HolderAirdropVault.IncompleteHolderSet.selector);
        airdrops.airdrop(token, onlyAlice);
    }

    function _buyAs(address user, PoolKey memory key, uint256 ethIn) internal {
        vm.prank(user);
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(user)
        );
    }

    function _circulatingHolders(address token, address a, address b) internal view returns (address[] memory holders) {
        address[8] memory candidates =
            [a, b, address(this), address(swapRouter), address(factory), ops, address(escrow), address(distributor)];
        uint256 n;
        for (uint256 i; i < candidates.length; ++i) {
            address c = candidates[i];
            if (c == address(0)) continue;
            if (airdrops.excluded(token, c)) continue;
            if (LaunchTokenLike(token).balanceOf(c) > 0) n++;
        }
        holders = new address[](n);
        uint256 j;
        for (uint256 i; i < candidates.length; ++i) {
            address c = candidates[i];
            if (c == address(0)) continue;
            if (airdrops.excluded(token, c)) continue;
            if (LaunchTokenLike(token).balanceOf(c) > 0) holders[j++] = c;
        }
    }
}
