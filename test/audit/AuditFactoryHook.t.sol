// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "../utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../../src/libraries/BitmaskConfig.sol";
import {McapVest} from "../../src/libraries/McapVest.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../../src/libraries/FixedPointMath.sol";
import {LaunchFactory} from "../../src/LaunchFactory.sol";
import {HktHolderDropVault} from "../../src/HktHolderDropVault.sol";
import {MockQuoteToken} from "../mocks/MockQuoteToken.sol";

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

contract MockAggregator {
    int256 public answer;
    uint256 public updatedAt;
    uint8 public decimals = 8;

    constructor(int256 answer_) {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function set(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// @notice Regression tests for the internal security review of LaunchFactory / MasterLaunchHook
///         (audit/INTERNAL_SECURITY_REVIEW.md, findings H-*). `test_Fixed_*` assert the patched
///         behaviour; `test_Known_*` pin down documented limitations so a change in behaviour is noticed.
contract AuditFactoryHookTest is LaunchpadTestBase {
    Currency internal constant ETH = Currency.wrap(address(0));
    address internal bob = address(0xB0B2);

    function setUp() public {
        deployProtocol();
        vm.deal(bob, 1_000 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H-1 (known limitation): the mcap vest high-water mark is a post-swap spot snapshot, so a
    //      same-block pump/dump unlocks the stream. Documented; a TWAP/time-in-range gate is the fix.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Known_H1_McapVestUnlockedBySpotPumpRoundTrip() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.buybackVesting = true; // creator's 60% goes to BuybackVault stream

        McapVest.Plan memory p;
        p.kind = McapVest.KIND_CLIFF;
        p.cliffPreset = 1; // $10,000,000 FDV cliff
        uint256 vest = McapVest.join(McapVest.pack(p), 0);

        (uint256 launchId, address token,) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Vest",
                symbol: "VST",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: ETH,
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(m),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: vest
            })
        );
        PoolKey memory key = factory.poolKeyOf(launchId);

        // Organic volume from another trader → creator stream accrues but is locked (FDV ≈ $5k).
        vm.prank(bob);
        swapRouter.swap{value: 2 ether}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -2 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(bob)
        );
        (, uint128 streamAmt,,,) = buybacks.streams(address(this), token);
        assertGt(streamAmt, 0, "creator stream accrued");
        assertEq(buybacks.vestedOf(address(this), token), 0, "locked below $10M cliff");
        assertLt(buybacks.highWaterFdvUsd(token), 10_000_000);

        // Creator pumps spot in a single swap, sells back next block.
        uint256 ethBefore = address(this).balance;
        vm.roll(block.number + 1);
        buyExactIn(key, 80 ether);
        uint256 hw = buybacks.highWaterFdvUsd(token);
        emit log_named_uint("high-water FDV USD after pump", hw);
        assertGe(hw, 10_000_000, "cliff crossed by a single spot pump");
        (, uint128 streamNow,,,) = buybacks.streams(address(this), token);
        assertEq(buybacks.vestedOf(address(this), token), streamNow, "100% of stream unlocked");

        vm.roll(block.number + 1);
        // Unwind with exact-output sells (fee = 1% of quote actually received; exact-input sells are charged
        // on pre-swap spot notional, which would be ~9x the real proceeds after a pump — see M-1).
        LaunchTokenLike(token).approve(address(swapRouter), type(uint256).max);
        // Sell back only what the pump bought: target ≈ pump size minus fees so bob's ETH stays in the pool.
        uint256 recovered;
        uint256 target = 78 ether;
        for (uint256 i; i < 12 && target - recovered > 0.01 ether; ++i) {
            uint256 ask = address(manager).balance * 3 / 5;
            if (ask > target - recovered) ask = target - recovered;
            BalanceDelta d = swapRouter.swap(
                key,
                SwapParams({
                    zeroForOne: false, amountSpecified: int256(ask), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
                }),
                PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
                abi.encode(address(this))
            );
            recovered += uint256(uint128(d.amount0()));
        }
        buybacks.claim(token);
        uint256 netCost = ethBefore - address(this).balance;
        emit log_named_uint("ETH recovered by selling back (wei)", recovered);
        emit log_named_uint("net ETH cost of round-trip incl. stream claim (wei)", netCost);
        emit log_named_uint("creator stream unlocked+claimed (wei)", streamNow);
        // Cost is a few % of the pump capital; 60% of the base fee paid on the way flows back to the creator.
        assertLt(netCost, 5 ether);
        // High-water mark never decays even though spot is back near $5k.
        assertGe(buybacks.highWaterFdvUsd(token), 10_000_000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // H-2 (fixed): the holder-airdrop epoch start used to sum every registered holder inside
    //      beforeSwap. The listed total is now tracked incrementally, so griefing the holder list
    //      with 1-wei transfers no longer inflates the swap cost.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Fixed_H2_HolderAirdropEpochStartGasIsBounded() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        buyExactIn(key, 5 ether); // fund the airdrop pot and become a holder

        // Baseline: epoch elapsed, a handful of holders.
        vm.warp(vm.getBlockTimestamp() + 61);
        vm.roll(block.number + 1);
        uint256 g0 = gasleft();
        buyExactIn(key, 0.01 ether);
        uint256 baseline = g0 - gasleft();
        emit log_named_uint("swap gas, ~2 holders, epoch start", baseline);

        // Griefer registers N holders with 1-wei transfers (permissionless; LaunchToken syncs on transfer).
        uint256 n = 3_000;
        for (uint256 i; i < n; ++i) {
            LaunchTokenLike(token).transfer(address(uint160(0x100000 + i)), 1);
        }
        assertGe(airdrops.registeredHolderCount(token), n);

        vm.warp(vm.getBlockTimestamp() + 61);
        vm.roll(block.number + 1);
        uint256 g1 = gasleft();
        buyExactIn(key, 0.01 ether);
        uint256 withHolders = g1 - gasleft();
        emit log_named_uint("swap gas, 3000 holders, epoch start", withHolders);
        // Epoch start is O(1); the only extra cost is the first 48-holder payout batch.
        assertLt(withHolders, baseline + 2_000_000, "epoch-start swap cost is independent of the holder count");
    }

    /// @dev Same pool, gas-capped: a swap with a normal budget succeeds and the epoch advances.
    function test_Fixed_H2_HolderAirdropEpochStartProgressesUnderGasCap() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        m.holderAirdropEpochSeconds = 60;
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        buyExactIn(key, 5 ether);
        vm.warp(vm.getBlockTimestamp() + 61);
        vm.roll(block.number + 1);
        buyExactIn(key, 0.01 ether); // first epoch pays out normally; refills pot
        uint64 lastPaid = airdrops.lastAirdropAt(token);
        assertGt(lastPaid, 0);

        uint256 n = 6_000;
        for (uint256 i; i < n; ++i) {
            LaunchTokenLike(token).transfer(address(uint160(0x200000 + i)), 1);
        }
        vm.warp(vm.getBlockTimestamp() + 61);
        vm.roll(block.number + 1);

        // A budget that covers a normal swap plus one payout batch is enough.
        uint256 g = gasleft();
        swapRouter.swap{value: 0.01 ether, gas: 2_500_000}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -0.01 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        uint256 used = g - gasleft();
        emit log_named_uint("gas used by one swap with 6000 holders", used);
        assertLt(used, 2_500_000);
        // The first payout batch went out during that swap (holder slot 0 is this contract).
        assertGt(manager.balanceOf(address(this), 0), 0, "batch 1 paid");
        assertEq(airdrops.lastAirdropAt(token), lastPaid, "epoch completes over the following swaps");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M-0 (known limitation): the max-wallet recipient comes from caller-controlled hookData, so the
    //      module only binds well-behaved routers. Documented; enforcing it needs a token-level cap.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Known_M0_MaxWalletBypassViaHookDataRecipient() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.maxWallet = true;
        m.maxWalletBps = 10; // 0.1% of supply
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);
        uint256 cap = FixedPointMath.applyBps(LaunchTokenLike(token).totalSupply(), 10);

        // ~0.001 ETH buys ~0.08% of supply at launch: under the per-trade cap, so honest hookData passes once...
        _buyWithRecipient(key, 0.001 ether, address(this));
        assertLe(LaunchTokenLike(token).balanceOf(address(this)), cap);

        // ...and a second honest buy that would push this wallet over the cap reverts.
        vm.expectRevert();
        _buyWithRecipient(key, 0.001 ether, address(this));

        // Same buys with hookData pointing at empty addresses: all pass, tokens still land on msg.sender.
        for (uint256 i = 1; i <= 12; ++i) {
            _buyWithRecipient(key, 0.001 ether, address(uint160(0xDEAD00 + i)));
        }
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        emit log_named_uint("max wallet cap", cap);
        emit log_named_uint("balance after bypass", bal);
        assertGt(bal, cap * 5, "single wallet holds >5x the max-wallet cap");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M-1 (fixed): exact-output buys are taxed on the pre-swap spot notional, which under-collected
    //      the sniper tax on large buys. While the tax is live, exact-output buys are rejected.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Fixed_M1_ExactOutputBuysRejectedWhileSnipeTaxIsLive() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.antiSnipe = true;
        m.antiSnipeDurationSeconds = 3600;
        m.initialSnipeTaxBps = 5_000;
        uint256 supply = ProtocolConstants.DEFAULT_LAUNCH_SUPPLY;
        (, address token,, PoolKey memory key) = launchToken(m, 0, supply);

        uint256 snap = vm.snapshotState();

        // (a) exact-in: 51% of quote is taken as fee.
        uint256 feesBefore = _feesCollected();
        BalanceDelta dIn = swapRouter.swap{value: 1 ether}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1 ether, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        uint256 paidIn = uint256(uint128(-dIn.amount0()));
        uint256 feeIn = _feesCollected() - feesBefore;
        emit log_named_uint("exact-in effective fee bps", feeIn * 10_000 / paidIn);
        assertApproxEqAbs(feeIn * 10_000 / paidIn, 5_100, 2);

        vm.revertToState(snap);

        // (b) exact-out for 40% of supply inside the snipe window: rejected instead of under-taxed.
        vm.expectRevert(); // WrappedError(MasterLaunchHook.ExactOutputDuringSnipe)
        swapRouter.swap{value: 100 ether}(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: int256(supply * 40 / 100),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        assertEq(LaunchTokenLike(token).balanceOf(address(this)), 0);

        // (c) once the window has decayed to zero, exact-output buys are accepted again.
        vm.warp(vm.getBlockTimestamp() + 3601);
        swapRouter.swap{value: 100 ether}(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: int256(supply * 5 / 100),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        assertEq(LaunchTokenLike(token).balanceOf(address(this)), supply * 5 / 100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M-2 (known limitation): a floor fill paid in raw quote (operator `deposit`) with auto-burn on
    //      credits pendingAutoBurn without claims, and the afterSwap burn reverts the sell. Documented:
    //      never top the FloorVault up with raw quote on auto-burn / HKT-drop / deepen pools; the
    //      permissionless `FloorVault.redeemFloor` exit is unaffected.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Known_M2_FloorFillRawPathRevertsWithAutoBurn() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.backedFloor = true;
        m.floorAllocationBps = 5_000;
        m.autoBurn = true;
        m.autoBurnBps = 5_000;
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000e18);

        // Operator tops up the floor with raw ETH (FloorVault.deposit is a supported operator path).
        vault.deposit{value: 50 ether}(token, ETH, 50 ether);

        buyExactIn(key, 0.01 ether);
        vm.roll(block.number + 1);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        assertEq(hook.pendingAutoBurn(poolId), 0);

        // Spot is far above floor but the sell would cross it → floor fill. Vault pays mostly raw ETH,
        // FeeSplitLib routes raw, pendingAutoBurn is credited, then _autoBurn tries to burn claims it
        // does not have → the whole sell reverts. Floor exits through the pool are unusable.
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: false, amountSpecified: -int256(bal / 2), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        // Sanity: the same config without auto-burn (existing test path) succeeds, so the floor path itself works.
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M-3 (fixed): launchMulti demanded devBuyQuoteIn wei of ETH whenever any market was native,
    //      even when the dev buy is paid in markets[0]'s ERC-20, stranding the ETH in the factory.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Fixed_M3_LaunchMultiErc20DevBuyNeedsNoEth() public {
        MockQuoteToken q = new MockQuoteToken("Stock", "STK", 18);
        factory.setQuote(address(q), true, 18, 2_000e18, address(0));
        q.approve(address(factory), type(uint256).max);

        LaunchFactory.MarketInput[] memory markets = new LaunchFactory.MarketInput[](2);
        markets[0] = LaunchFactory.MarketInput({quote: Currency.wrap(address(q)), bps: 5_000});
        markets[1] = LaunchFactory.MarketInput({quote: ETH, bps: 5_000});

        uint256 devBuy = 0.05e18; // 0.05 STK ≈ $100 (< 2.5% of $5k)
        uint256 factoryEthBefore = address(factory).balance;
        uint256 qBefore = q.balanceOf(address(this));

        // Only the launch fee is needed in ETH; the dev buy is pulled in STK.
        factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI}(_multiParams(markets, devBuy));

        assertEq(qBefore - q.balanceOf(address(this)), devBuy, "dev buy was paid in the ERC-20");
        uint256 kept = address(factory).balance - factoryEthBefore;
        emit log_named_uint("ETH kept by factory (wei)", kept);
        assertLe(kept, 1, "only the 1-wei native dust stays in the factory");

        // Over-paying ETH is refunded rather than kept.
        uint256 ethBefore = address(this).balance;
        factory.launchMulti{value: ProtocolConstants.LAUNCH_FEE_WEI + devBuy}(_multiParams(markets, devBuy));
        assertApproxEqAbs(ethBefore - address(this).balance, ProtocolConstants.LAUNCH_FEE_WEI, 1, "extra ETH refunded");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // M-4 (fixed): a stale/failed USD feed on an ERC-20 quote used to revert every swap on pools
    //      with an mcap vest. FDV observation is now best-effort and never blocks trading.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Fixed_M4_StaleQuoteFeedDoesNotBlockSwapsOnVestPools() public {
        MockQuoteToken q = new MockQuoteToken("USD", "USD", 18);
        MockAggregator feed = new MockAggregator(1e8);
        factory.setQuote(address(q), true, 18, 0, address(feed));
        q.approve(address(swapRouter), type(uint256).max);

        McapVest.Plan memory p;
        p.kind = McapVest.KIND_CLIFF;
        p.cliffPreset = 1;
        uint256 vest = McapVest.join(McapVest.pack(p), 0);

        (uint256 launchId, address token,) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Feed",
                symbol: "FD",
                metadataURI: "",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(q)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: BitmaskConfig.pack(defaultModules()),
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0,
                vestPacked: vest
            })
        );
        PoolKey memory key = factory.poolKeyOf(launchId);
        bool qIs0 = Currency.unwrap(key.currency0) == address(q);

        _swapErc20(key, qIs0, 100e18); // fresh feed: OK
        assertGt(LaunchTokenLike(token).balanceOf(address(this)), 0);

        uint256 hwm = buybacks.highWaterFdvUsd(token);
        assertGt(hwm, 0, "fresh feed observed an FDV");

        vm.warp(vm.getBlockTimestamp() + ProtocolConstants.ORACLE_MAX_AGE + 1);
        uint256 before = LaunchTokenLike(token).balanceOf(address(this));
        _swapErc20(key, qIs0, 100e18); // stale feed: buy still goes through
        assertGt(LaunchTokenLike(token).balanceOf(address(this)), before);
        assertEq(buybacks.highWaterFdvUsd(token), hwm, "no FDV observation while the feed is stale");

        // Sells too — holders can always exit through the pool.
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        LaunchTokenLike(token).approve(address(swapRouter), bal);
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: !qIs0,
                amountSpecified: -int256(bal),
                sqrtPriceLimitX96: !qIs0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
        assertEq(LaunchTokenLike(token).balanceOf(address(this)), 0, "sold out while the feed is stale");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // L-1 (fixed): HktHolderDropVault is excluded from holder airdrops at pool init, so it no longer
    //      captures quote airdrop shares it can never spend.
    // ─────────────────────────────────────────────────────────────────────────
    function test_Fixed_L1_HktDropVaultExcludedFromAirdropHolders() public {
        HktHolderDropVault drop = new HktHolderDropVault(address(this));
        drop.setHkt(address(0x1234)); // any non-zero token address flips _hktDropReady()
        drop.setOperator(address(hook), true);
        hook.setHktDropVault(drop);

        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 200;
        m.holderAirdrop = true;
        m.holderAirdropBps = 10_000;
        (, address token,, PoolKey memory key) = launchToken(m, 0, ProtocolConstants.DEFAULT_LAUNCH_SUPPLY);

        buyExactIn(key, 1 ether);
        vm.roll(block.number + 1);
        buyExactIn(key, 1 ether); // afterSwap of this swap executes the pending HKT-drop buy

        assertGt(LaunchTokenLike(token).balanceOf(address(drop)), 0, "vault holds launched tokens");
        assertTrue(airdrops.excluded(token, address(drop)), "vault is excluded from holder airdrops");
        address[] memory holders = airdrops.holderList(token);
        for (uint256 i; i < holders.length; ++i) {
            assertTrue(holders[i] != address(drop), "vault must not be in the holder list");
        }
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    function _buyWithRecipient(PoolKey memory key, uint256 ethIn, address recipient) internal {
        swapRouter.swap{value: ethIn}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(recipient)
        );
    }

    function _feesCollected() internal view returns (uint256) {
        return escrow.balanceOf(address(this), ETH) + distributor.pending(ETH);
    }

    function _swapErc20(PoolKey memory key, bool qIs0, uint256 amountIn) internal {
        swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: qIs0,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: qIs0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            abi.encode(address(this))
        );
    }

    function _multiParams(LaunchFactory.MarketInput[] memory markets, uint256 devBuy)
        internal
        pure
        returns (LaunchFactory.LaunchMultiParams memory)
    {
        return LaunchFactory.LaunchMultiParams({
            name: "Multi",
            symbol: "MLT",
            metadataURI: "",
            totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            markets: markets,
            tickSpacing: 60,
            bitmask: 0,
            customHook: IHooks(address(0)),
            floorQuoteIndex: 0,
            devBuyQuoteIn: devBuy,
            minDevBuyTokensOut: 0,
            vestPacked: 0
        });
    }
}
