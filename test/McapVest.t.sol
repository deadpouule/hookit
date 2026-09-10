// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {McapVest} from "../src/libraries/McapVest.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

contract McapVestTest is Test {
    BuybackVault buybacks;
    HolderAirdropVault airdrops;
    address creator = address(0xC0);
    address token = address(0x70);

    function setUp() public {
        buybacks = new BuybackVault(address(this), IPoolManager(address(0)));
        airdrops = new HolderAirdropVault(address(this), IPoolManager(address(0)));
        buybacks.setOperator(address(this), true);
        airdrops.setOperator(address(this), true);
        vm.deal(address(this), 100 ether);
        vm.deal(address(buybacks), 0);
    }

    function _cliff(uint8 preset) internal pure returns (uint128) {
        McapVest.Plan memory p;
        p.kind = McapVest.KIND_CLIFF;
        p.cliffPreset = preset;
        return McapVest.pack(p);
    }

    function _steps(uint8[6] memory presets, uint8[6] memory pcts, uint8 n) internal pure returns (uint128) {
        McapVest.Plan memory p;
        p.kind = McapVest.KIND_STEPS;
        p.stepCount = n;
        for (uint256 i; i < n; ++i) {
            p.steps[i].preset = presets[i];
            p.steps[i].pct = pcts[i];
        }
        return McapVest.pack(p);
    }

    function testPresetUsd() public pure {
        assertEq(McapVest.presetUsd(0), 5_000_000);
        assertEq(McapVest.presetUsd(1), 10_000_000);
        assertEq(McapVest.presetUsd(6), 10_000_000_000);
    }

    function testJoinSplit() public pure {
        uint256 packed = McapVest.join(uint128(11), uint128(22));
        assertEq(McapVest.buybackSlice(packed), 11);
        assertEq(McapVest.airdropSlice(packed), 22);
    }

    function testCliffUnlock() public pure {
        McapVest.Plan memory p;
        p.kind = McapVest.KIND_CLIFF;
        p.cliffPreset = 1; // 10M
        assertEq(McapVest.unlockedBps(p, 9_999_999), 0);
        assertEq(McapVest.unlockedBps(p, 10_000_000), 10_000);
    }

    function testStepUnlock() public pure {
        McapVest.Plan memory p;
        p.kind = McapVest.KIND_STEPS;
        p.stepCount = 6;
        p.steps[0] = McapVest.Step(1, 5);
        p.steps[1] = McapVest.Step(2, 5);
        p.steps[2] = McapVest.Step(3, 15);
        p.steps[3] = McapVest.Step(4, 20);
        p.steps[4] = McapVest.Step(5, 25);
        p.steps[5] = McapVest.Step(6, 30);
        assertEq(McapVest.unlockedBps(p, 0), 0);
        assertEq(McapVest.unlockedBps(p, 10_000_000), 500);
        assertEq(McapVest.unlockedBps(p, 50_000_000), 1_000);
        assertEq(McapVest.unlockedBps(p, 10_000_000_000), 10_000);
    }

    function testPackRoundTrip() public pure {
        McapVest.Plan memory p;
        p.kind = McapVest.KIND_STEPS;
        p.durationSeconds = 7 days;
        p.stepCount = 2;
        p.steps[0] = McapVest.Step(1, 40);
        p.steps[1] = McapVest.Step(6, 60);
        McapVest.Plan memory out = McapVest.unpack(McapVest.pack(p));
        assertEq(out.kind, p.kind);
        assertEq(out.durationSeconds, p.durationSeconds);
        assertEq(out.stepCount, 2);
        assertEq(out.steps[0].preset, 1);
        assertEq(out.steps[0].pct, 40);
        assertEq(out.steps[1].pct, 60);
    }

    function testBuybackRejectsFiveMillion() public {
        vm.expectRevert(McapVest.InvalidPreset.selector);
        buybacks.configurePlan(token, _cliff(0));
    }

    function testBuybackCliffClaim() public {
        buybacks.configurePlan(token, _cliff(1));
        buybacks.credit{value: 1 ether}(creator, token, Currency.wrap(address(0)), 1 ether, uint64(30 days));
        assertEq(buybacks.vestedOf(creator, token), 0);
        buybacks.observeFdv(token, 9_000_000);
        assertEq(buybacks.vestedOf(creator, token), 0);
        buybacks.observeFdv(token, 10_000_000);
        assertEq(buybacks.vestedOf(creator, token), 1 ether);
        vm.prank(creator);
        buybacks.claim(token);
        assertEq(creator.balance, 1 ether);
    }

    function testBuybackStepClaim() public {
        uint8[6] memory presets = [1, 2, 3, 4, 5, 6];
        uint8[6] memory pcts = [5, 5, 15, 20, 25, 30];
        buybacks.configurePlan(token, _steps(presets, pcts, 6));
        buybacks.credit{value: 100 ether}(creator, token, Currency.wrap(address(0)), 100 ether, uint64(30 days));
        buybacks.observeFdv(token, 10_000_000);
        assertEq(buybacks.vestedOf(creator, token), 5 ether);
        vm.prank(creator);
        buybacks.claim(token);
        assertEq(creator.balance, 5 ether);
        buybacks.observeFdv(token, 50_000_000);
        assertEq(buybacks.vestedOf(creator, token), 5 ether);
    }

    function testAirdropEligibleCliff() public {
        airdrops.configurePlan(token, _cliff(0)); // 5M allowed for airdrop
        airdrops.depositInternal(token, Currency.wrap(address(0)), 10 ether);
        vm.deal(address(airdrops), 10 ether);
        assertEq(airdrops.eligibleOf(token, Currency.wrap(address(0))), 0);
        airdrops.observeFdv(token, 5_000_000);
        assertEq(airdrops.eligibleOf(token, Currency.wrap(address(0))), 10 ether);
    }

    function testAirdropEligibleSteps() public {
        uint8[6] memory presets = [0, 1, 2, 3, 5, 6];
        uint8[6] memory pcts = [5, 5, 15, 20, 25, 30];
        airdrops.configurePlan(token, _steps(presets, pcts, 6));
        airdrops.depositInternal(token, Currency.wrap(address(0)), 100 ether);
        assertEq(airdrops.eligibleOf(token, Currency.wrap(address(0))), 0);
        airdrops.observeFdv(token, 5_000_000);
        assertEq(airdrops.eligibleOf(token, Currency.wrap(address(0))), 5 ether);
        airdrops.observeFdv(token, 10_000_000);
        assertEq(airdrops.eligibleOf(token, Currency.wrap(address(0))), 10 ether);
    }

    function testHighWaterDoesNotDecrease() public {
        buybacks.configurePlan(token, _cliff(1));
        buybacks.credit{value: 1 ether}(creator, token, Currency.wrap(address(0)), 1 ether, uint64(30 days));
        buybacks.observeFdv(token, 10_000_000);
        assertEq(buybacks.vestedOf(creator, token), 1 ether);
        buybacks.observeFdv(token, 1_000_000);
        assertEq(buybacks.highWaterFdvUsd(token), 10_000_000);
        assertEq(buybacks.vestedOf(creator, token), 1 ether);
    }
}
