// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2} from "forge-std/console2.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {LaunchpadTestBase, LaunchTokenLike} from "../utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";
import {HktHolderDropVault} from "../../src/HktHolderDropVault.sol";
import {HkitBuyback} from "../../src/HkitBuyback.sol";
import {FeeEthRail} from "../../src/FeeEthRail.sol";
import {LaunchToken} from "../../src/LaunchToken.sol";

/// @notice Regression tests for the internal security review of the fee routing / vault layer
///         (audit/INTERNAL_SECURITY_REVIEW.md, findings V-*). Each test started life as a PoC that
///         demonstrated the bug and now asserts the fixed behaviour.
contract AuditFeesVaultsTest is LaunchpadTestBase {
    using CurrencyLibrary for Currency;

    Currency internal constant ETH = Currency.wrap(address(0));

    HktHolderDropVault internal drop;
    LaunchToken internal hkt;

    function setUp() public {
        deployProtocol();
        drop = new HktHolderDropVault(address(this));
        hkt = new LaunchToken("Hookit", "HKT", 1_000_000_000e18, address(this), address(this), "", address(drop));
        drop.setHkt(address(hkt));
        drop.setOperator(address(this), true);
        drop.setOperator(address(hook), true);
        // Deployer/treasury is infra, not a holder.
        drop.setExcluded(address(this), true);
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-1  HktHolderDropVault.tryPush used to pay each 48-holder batch on LIVE
    //      balanceOf against a total fixed at epoch start: moving the same HKT
    //      from a batch-1 wallet to a batch-2 wallet was paid twice and starved
    //      later honest holders. Payouts are now capped by the lazy epoch snapshot.
    // ────────────────────────────────────────────────────────────────────────
    function test_V1_HktDrop_NoDoubleCountAcrossBatches() public {
        address a1 = address(0xA1A1);
        address a2 = address(0xA2A2);
        uint256 big = 100_000e18;
        uint256 small = 10_000e18;
        uint256 honestCount = 58;
        address[] memory honest = new address[](honestCount);

        // Holder slots: a1 = 0, honest[0..46] = 1..47, a2 = 48, honest[47..57] = 49..59.
        hkt.transfer(a1, big);
        for (uint256 i; i < 47; ++i) {
            honest[i] = address(uint160(0x5000 + i));
            hkt.transfer(honest[i], small);
        }
        hkt.transfer(a2, 1e18);
        for (uint256 i = 47; i < honestCount; ++i) {
            honest[i] = address(uint160(0x5000 + i));
            hkt.transfer(honest[i], small);
        }
        assertEq(drop.holderCount(), 60);
        uint256 totalListed = big + honestCount * small + 1e18;

        // Pot: 1 meme per listed HKT so shares are easy to read.
        LaunchToken meme = new LaunchToken("Meme", "MEME", totalListed, address(this), address(this), "", address(0));
        meme.transfer(address(drop), totalListed);
        drop.creditInternal(address(meme), totalListed);
        uint256 pot = totalListed;

        // Batch 1 (slots 0..47): a1 paid 100k on live balance.
        assertFalse(drop.tryPush(address(meme)));
        assertEq(meme.balanceOf(a1), big);

        // Attacker moves the stack to the batch-2 wallet (keeps 1 wei so a1 is not de-listed / list not reordered).
        vm.prank(a1);
        hkt.transfer(a2, big - 1);

        // Batch 2 (slots 48..59): a2 paid again on the same HKT.
        assertTrue(drop.tryPush(address(meme)));

        uint256 fairAttacker = pot * (big + 1e18) / totalListed;
        uint256 gotAttacker = meme.balanceOf(a1) + meme.balanceOf(a2);
        console2.log("pot                 ", pot);
        console2.log("attacker fair share ", fairAttacker);
        console2.log("attacker received   ", gotAttacker);
        assertEq(gotAttacker, fairAttacker, "attacker is paid exactly once for the HKT held at epoch start");

        for (uint256 i; i < honestCount; ++i) {
            assertEq(meme.balanceOf(honest[i]), pot * small / totalListed, "honest holder paid full share");
        }
        assertEq(drop.potOf(address(meme)), 0, "pot fully consumed");
    }

    /// The epoch snapshot is lazy: a holder who buys more HKT mid-epoch is paid on the pre-buy balance,
    /// a holder who sells is paid on what they still hold, and a wallet listed mid-epoch gets nothing.
    function test_V1_HktDrop_SnapshotSemantics() public {
        address early = address(0xE1);
        address seller = address(0x5E11);
        address late = address(0x1A7E);
        hkt.transfer(early, 100e18);
        hkt.transfer(seller, 100e18);
        // 49 fillers so `late` (listed mid-epoch) would land in batch 2 if it were listed.
        for (uint256 i; i < 49; ++i) {
            hkt.transfer(address(uint160(0x7000 + i)), 1e18);
        }
        uint256 listedAtStart = drop.listedTotal();

        LaunchToken meme = new LaunchToken("Meme", "MEME", 1_000e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 1_000e18);
        drop.creditInternal(address(meme), 1_000e18);

        assertFalse(drop.tryPush(address(meme))); // batch 1 (early, seller, 46 fillers)
        // Mid-epoch movements.
        hkt.transfer(early, 100e18); // early doubles up
        vm.prank(seller);
        hkt.transfer(late, 60e18); // seller dumps most of it to a brand-new wallet
        assertTrue(drop.tryPush(address(meme))); // batch 2

        assertEq(meme.balanceOf(early), 1_000e18 * 100e18 / listedAtStart, "paid on epoch-start balance");
        assertEq(meme.balanceOf(seller), 1_000e18 * 100e18 / listedAtStart, "already paid before selling");
        assertEq(meme.balanceOf(late), 0, "listed mid-epoch: nothing this epoch");
        assertEq(drop.listedTotal(), listedAtStart + 100e18, "running total tracks live balances");
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-1b Same fix in HolderAirdropVault._tryAutoAirdrop (quote airdrop).
    //      tryAutoAirdrop is permissionless so the attacker controls batch timing.
    // ────────────────────────────────────────────────────────────────────────
    function test_V1b_HolderAirdrop_NoDoubleCountAcrossBatches() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        buyExactIn(key, 20 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this)); // this = slot 0

        address a1 = address(0xA1A1);
        address a2 = address(0xA2A2);
        uint256 big = bal * 40 / 100;
        uint256 small = bal / 200;
        uint256 honestCount = 57;
        address[] memory honest = new address[](honestCount);

        // Slots: this = 0, a1 = 1, honest[0..45] = 2..47, a2 = 48, honest[46..56] = 49..59.
        LaunchTokenLike(token).transfer(a1, big);
        for (uint256 i; i < 46; ++i) {
            honest[i] = address(uint160(0x6000 + i));
            LaunchTokenLike(token).transfer(honest[i], small);
        }
        LaunchTokenLike(token).transfer(a2, 1e18);
        for (uint256 i = 46; i < honestCount; ++i) {
            honest[i] = address(uint160(0x6000 + i));
            LaunchTokenLike(token).transfer(honest[i], small);
        }
        assertEq(airdrops.holderCount(token), 60);

        uint256 pot = airdrops.potOf(token, ETH);
        assertGt(pot, 0);
        uint256 totalListed = LaunchTokenLike(token).totalSupply() - LaunchTokenLike(token).balanceOf(address(manager))
            - LaunchTokenLike(token).balanceOf(address(hook));

        vm.warp(block.timestamp + 60);
        // Batch 1 (slots 0..47) — permissionless trigger.
        assertFalse(airdrops.tryAutoAirdrop(token));
        uint256 a1Paid = manager.balanceOf(a1, 0);
        assertGt(a1Paid, 0);

        vm.prank(a1);
        LaunchTokenLike(token).transfer(a2, big - 1);

        // Batch 2 (slots 48..59).
        assertTrue(airdrops.tryAutoAirdrop(token));
        uint256 a2Paid = manager.balanceOf(a2, 0);

        uint256 fairAttacker = pot * (big + 1e18) / totalListed;
        console2.log("pot                 ", pot);
        console2.log("attacker fair share ", fairAttacker);
        console2.log("attacker received   ", a1Paid + a2Paid);
        assertApproxEqAbs(a1Paid + a2Paid, fairAttacker, 2, "attacker paid exactly once");
        for (uint256 i; i < honestCount; ++i) {
            assertApproxEqAbs(
                manager.balanceOf(honest[i], 0), pot * small / totalListed, 2, "honest holder paid full share"
            );
        }
        assertLt(airdrops.potOf(token, ETH), 100, "pot consumed up to rounding dust");
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-2  Epoch start used to sum every listed holder's balance inside the
    //      beforeSwap of every Master pool (holder set is global and anyone can
    //      grow it with 1-wei transfers). The total is now maintained
    //      incrementally, so the epoch starts in O(1) and swaps keep working.
    // ────────────────────────────────────────────────────────────────────────
    function test_V2_HktDrop_EpochStartIsBoundedWithThousandsOfHolders() public {
        uint256 n = 6000;
        for (uint256 i; i < n; ++i) {
            hkt.transfer(address(uint160(0x100000 + i)), 1);
        }
        assertEq(drop.holderCount(), n);

        // Direct cost of the epoch-start sum.
        LaunchToken meme = new LaunchToken("Meme", "MEME", 1_000e18, address(this), address(this), "", address(0));
        meme.transfer(address(drop), 1_000e18);
        drop.creditInternal(address(meme), 1_000e18);
        uint256 g0 = gasleft();
        drop.tryPush(address(meme));
        uint256 used = g0 - gasleft();
        console2.log("holders", n);
        console2.log("tryPush gas (epoch start + first batch)", used);
        assertLt(used, 2_500_000, "epoch start no longer scales with the holder count");

        // Live Master pool: the 10% HKT cut buys the launch token into `drop`; the next swap's
        // beforeSwap calls drop.tryPush(token) → _sumListedHkt over 6000 holders.
        hook.setHktDropVault(drop);
        (, address token,, PoolKey memory key) =
            launchToken(defaultModules(), 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        buyExactIn(key, 1 ether);
        uint256 potBefore = drop.potOf(token);
        assertGt(potBefore, 0, "pot funded by 10% cut");

        bytes memory callData = abi.encodeCall(
            PoolSwapTest.swap,
            (
                key,
                SwapParams({
                    zeroForOne: true,
                    amountSpecified: -int256(0.1 ether),
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
                }),
                PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
                abi.encode(address(this))
            )
        );

        // A normal L2 swap budget is enough: the epoch starts in O(1) and pays one 48-holder batch.
        uint256 g1 = gasleft();
        (bool ok,) = address(swapRouter).call{value: 0.1 ether, gas: 4_000_000}(callData);
        uint256 swapGas = g1 - gasleft();
        console2.log("swap with 4M gas ok?", ok);
        console2.log("swap gas consumed", swapGas);
        assertTrue(ok, "swap succeeds with 6000 dust holders listed");
        assertLt(swapGas, 4_000_000);

        // The drop progressed: the first batch (dust holders 0..47) was paid out of the pot.
        assertGt(LaunchTokenLike(token).balanceOf(address(0x100000)), 0, "batch-1 holder paid during the swap");
        assertEq(LaunchTokenLike(token).balanceOf(address(0x100000 + 100)), 0, "batch-3 holder waits for a later swap");
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-3  ERC-20 (USDG / wStock) protocol fees: the 80% flywheel share lands in
    //      `buybackExecutor` (HkitBuyback on Ink), which only knows how to swap ETH.
    //      The owner can now sweep those balances; nobody else can.
    // ────────────────────────────────────────────────────────────────────────
    function test_V3_Erc20ProtocolFees_RecoverableFromHkitBuyback() public {
        LaunchToken usdg = new LaunchToken("USDG", "USDG", 1_000_000e6, address(this), address(this), "", address(0));
        HkitBuyback bb = new HkitBuyback(address(this), manager, distributor);
        distributor.setBuybackExecutor(address(bb)); // mirrors HkitLaunchLib / RedeployHookitInk / VerifyInkDeploy

        usdg.approve(address(distributor), 1_000e6);
        distributor.notify(Currency.wrap(address(usdg)), 1_000e6);

        vm.prank(address(0xBAD));
        distributor.distribute(Currency.wrap(address(usdg)));

        assertEq(usdg.balanceOf(ops), 200e6);
        assertEq(usdg.balanceOf(address(bb)), 800e6, "80% lands in HkitBuyback");

        vm.prank(address(0xBAD));
        vm.expectRevert();
        bb.sweep(Currency.wrap(address(usdg)), address(0xBAD), 800e6);

        bb.sweep(Currency.wrap(address(usdg)), ops, 800e6);
        assertEq(usdg.balanceOf(address(bb)), 0);
        assertEq(usdg.balanceOf(ops), 1_000e6, "owner routed the stuck USDG to the ops treasury");

        // execute() is operator-gated: the caller picks minTokensOut.
        vm.prank(address(0xBAD));
        vm.expectRevert(HkitBuyback.NotOperator.selector);
        bb.execute(1 ether, 0);
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-4  FeeEthRail swaps used to accept an arbitrary `payer`, letting anyone
    //      spend an allowance granted to the rail. The payer must now be the caller.
    // ────────────────────────────────────────────────────────────────────────
    function test_V4_FeeEthRail_PayerMustBeCaller() public {
        deployMintAndApprove2Currencies();
        address usdgTok = Currency.unwrap(currency1);
        FeeEthRail rail = new FeeEthRail(address(this), manager, usdgTok);

        vm.deal(address(this), 1_000 ether);
        (PoolKey memory bridge,) = initPool(ETH, currency1, IHooks(address(0)), 3000, 60, SQRT_PRICE_1_1);
        modifyLiquidityRouter.modifyLiquidity{value: 500 ether}(
            bridge, ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 10_000e18, salt: 0}), ""
        );
        rail.setEthBridge(bridge, address(0));

        address victim = address(0x7157);
        address attacker = address(0xA77);
        IERC20Minimal(usdgTok).transfer(victim, 1 ether);
        vm.prank(victim);
        IERC20Minimal(usdgTok).approve(address(rail), 1 ether); // e.g. dangling approval after a partial fill

        vm.prank(attacker);
        vm.expectRevert(FeeEthRail.PayerMismatch.selector);
        rail.usdgToEth(1 ether, 0, victim, attacker);
        assertEq(IERC20Minimal(usdgTok).balanceOf(victim), 1 ether, "victim's allowance untouched");

        // The legitimate flow (payer == caller) still works.
        vm.prank(victim);
        uint256 out = rail.usdgToEth(1 ether, 0, victim, victim);
        assertGt(out, 0.9 ether);
        assertEq(victim.balance, out);
    }

    // ────────────────────────────────────────────────────────────────────────
    // V-5  HktHolderDropVault holds launch tokens between epochs (the 10% cut buys
    //      them) and cannot spend ERC-6909 quote claims. It is now excluded from
    //      the holder airdrop at pool init so no epoch slice leaks into it.
    // ────────────────────────────────────────────────────────────────────────
    function test_V5_HktDropVault_ExcludedFromHolderAirdrop() public {
        hkt.transfer(address(0xA11CE), 1_000e18);
        hook.setHktDropVault(drop);

        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        buyExactIn(key, 5 ether);
        assertGt(LaunchTokenLike(token).balanceOf(address(drop)), 0, "drop holds launch token between epochs");
        address[] memory holders = airdrops.holderList(token);
        bool listed;
        for (uint256 i; i < holders.length; ++i) {
            if (holders[i] == address(drop)) listed = true;
        }
        assertFalse(listed, "drop vault must not be a tracked airdrop holder");
        assertTrue(airdrops.excluded(token, address(drop)));

        vm.warp(block.timestamp + 60);
        assertTrue(airdrops.tryAutoAirdrop(token));
        assertEq(manager.balanceOf(address(drop), 0), 0, "no quote claims leak into the drop vault");
    }
}
