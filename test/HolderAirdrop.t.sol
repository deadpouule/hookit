// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";

contract AirdropReenter {
    HolderAirdropVault public vault;
    address public token;
    uint256 public hits;

    constructor(HolderAirdropVault vault_, address token_) {
        vault = vault_;
        token = token_;
    }

    receive() external payable {
        hits += 1;
        try vault.tryAutoAirdrop(token) {} catch {}
    }
}

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
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 120;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        _buyAs(alice, key, 1 ether);
        _buyAs(bob, key, 1 ether);
        _buyAs(alice, key, 0.2 ether);

        vm.warp(block.timestamp + 120);
        uint64 lastBefore = airdrops.lastAirdropAt(token);
        _buyAs(bob, key, 0.05 ether);
        assertTrue(hook.airdropDue(token));
        _buyAs(alice, key, 0.05 ether);
        assertGt(airdrops.lastAirdropAt(token), lastBefore);
    }

    function testHookTriggersAutoAirdropAfterEpoch() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 120;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        _buyAs(alice, key, 1 ether);
        _buyAs(bob, key, 1 ether);
        _buyAs(alice, key, 0.2 ether);

        vm.warp(block.timestamp + 120);
        assertGt(airdrops.reserve(token), 0);
        assertGe(airdrops.holderCount(token), 2);

        uint64 lastBefore = airdrops.lastAirdropAt(token);
        _buyAs(bob, key, 0.05 ether);
        assertTrue(hook.airdropDue(token));
        _buyAs(alice, key, 0.05 ether);
        assertGt(airdrops.lastAirdropAt(token), lastBefore);
    }

    function testTryAutoAirdropCallableByHook() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        _buyAs(alice, key, 0.5 ether);

        vm.prank(address(hook));
        assertTrue(airdrops.tryAutoAirdrop(token));
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

    function testSyncHolderTracksBuyersOnChain() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.holderAirdrop = true;
        m.hookTaxBps = 200;
        m.holderAirdropBps = 10_000;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        assertEq(airdrops.holderCount(token), 0);

        _buyAs(alice, key, 0.2 ether);
        assertGt(airdrops.holderCount(token), 0);
        assertGt(LaunchTokenLike(token).balanceOf(alice), 0);

        _buyAs(bob, key, 0.2 ether);
        assertGe(airdrops.holderCount(token), 2);
    }

    /// Selling / transferring a full balance drops the holder from the tracked set.
    /// The last-indexed holder used to panic out of bounds in `_removeHolder`.
    function testFullExitOfLastHolderDoesNotRevert() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.holderAirdrop = true;
        m.hookTaxBps = 200;
        m.holderAirdropBps = 10_000;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        _buyAs(alice, key, 0.2 ether);
        _buyAs(bob, key, 0.2 ether);
        uint256 before = airdrops.holderCount(token);
        assertGe(before, 2);

        address carol = address(0xCA201);
        uint256 bobBal = LaunchTokenLike(token).balanceOf(bob);
        vm.prank(bob);
        LaunchTokenLike(token).transfer(carol, bobBal);

        assertEq(LaunchTokenLike(token).balanceOf(bob), 0);
        assertEq(airdrops.holderCount(token), before);
        address[] memory holders = airdrops.holderList(token);
        bool bobListed;
        bool carolListed;
        for (uint256 i; i < holders.length; ++i) {
            if (holders[i] == bob) bobListed = true;
            if (holders[i] == carol) carolListed = true;
        }
        assertFalse(bobListed);
        assertTrue(carolListed);

        // Removing a middle holder keeps the moved holder's index consistent.
        uint256 aliceBal = LaunchTokenLike(token).balanceOf(alice);
        vm.prank(alice);
        LaunchTokenLike(token).transfer(carol, aliceBal);
        holders = airdrops.holderList(token);
        assertEq(holders.length, before - 1);
        for (uint256 i; i < holders.length; ++i) {
            assertTrue(holders[i] != alice && holders[i] != bob);
        }
    }

    function testReentrantAirdropCannotDoublePay() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;

        (, address token,, PoolKey memory key) = launchToken(m, int24(0), ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        _buyAs(alice, key, 1 ether);
        _buyAs(bob, key, 1 ether);

        AirdropReenter reenter = new AirdropReenter(airdrops, token);
        uint256 slice = LaunchTokenLike(token).balanceOf(alice) / 2;
        vm.prank(alice);
        LaunchTokenLike(token).transfer(address(reenter), slice);

        vm.warp(block.timestamp + 60);
        uint256 reserveBefore = airdrops.reserve(token);
        assertGt(reserveBefore, 0);

        bool done = airdrops.tryAutoAirdrop(token);
        assertTrue(done);
        uint256 reserveAfter = airdrops.reserve(token);
        assertLt(reserveAfter, reserveBefore);
        // Malicious recipient may reenter once; accounting already committed so reserve cannot be drained twice.
        assertLe(reenter.hits(), 1);
        assertEq(airdrops.reserve(token), reserveAfter);
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
}
