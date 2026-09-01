// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";

/// @notice Fuzz + invariant tests proving the backed-floor ratchet ΔP_floor ≥ 0.
contract BackedFloorInvariantTest is Test {
    FloorVault vault;
    LaunchToken token;
    FloorHandler handler;

    function setUp() public {
        vault = new FloorVault(address(this), IPoolManager(address(0)));
        token = new LaunchToken("Floor", "FLR", 1_000_000_000e18, address(this), address(this), "", address(0));
        vault.setOperator(address(this), true);

        handler = new FloorHandler(vault, token);
        token.transfer(address(handler), token.totalSupply() / 2);
        vault.setOperator(address(handler), true);
        vm.deal(address(handler), 100_000 ether);
        vm.deal(address(this), 10_000 ether);

        targetContract(address(handler));
    }

    /// forge-config: default.fuzz.runs = 10000
    function testFuzz_ratchetNeverDecreases(uint256 depositWei, uint256 burnAmt) public {
        depositWei = bound(depositWei, 1, 50 ether);
        vault.deposit{value: depositWei}(address(token), Currency.wrap(address(0)), depositWei);
        uint256 floorBefore = vault.floorPriceX18(address(token));

        burnAmt = bound(burnAmt, 1, token.balanceOf(address(this)));
        token.approve(address(vault), burnAmt);
        try vault.redeemFloor(address(token), burnAmt) {
            assertGe(vault.floorPriceX18(address(token)), floorBefore);
        } catch {
            assertEq(vault.floorPriceX18(address(token)), floorBefore);
        }
    }

    function invariant_floorNeverDecreases() public view {
        assertGe(handler.lastFloorX18(), handler.minFloorX18());
        assertGe(vault.floorPriceX18(address(token)), handler.minFloorX18());
    }

    function invariant_reserveMatchesBalance() public view {
        assertEq(vault.reserve(address(token)), address(vault).balance);
    }
}

contract FloorHandler {
    FloorVault public vault;
    LaunchToken public token;
    uint256 public minFloorX18;
    uint256 public lastFloorX18;
    uint256 public ghostDeposits;
    uint256 public ghostRedeems;

    constructor(FloorVault vault_, LaunchToken token_) {
        vault = vault_;
        token = token_;
    }

    receive() external payable {}

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, address(this).balance / 2 + 1);
        if (amount == 0 || address(this).balance < amount) return;
        vault.deposit{value: amount}(address(token), Currency.wrap(address(0)), amount);
        ghostDeposits += amount;
        _checkpoint();
    }

    function redeem(uint256 amount) external {
        uint256 bal = token.balanceOf(address(this));
        if (bal == 0 || vault.reserve(address(token)) == 0) return;
        amount = bound(amount, 1, bal);
        token.approve(address(vault), amount);
        try vault.redeemFloor(address(token), amount) {
            ghostRedeems += amount;
            _checkpoint();
        } catch {
            _checkpoint();
        }
    }

    function _checkpoint() internal {
        lastFloorX18 = vault.floorPriceX18(address(token));
        if (lastFloorX18 < minFloorX18) {
            // Recorded for the invariant; should never happen.
            revert("floor decreased");
        }
        if (lastFloorX18 > minFloorX18) minFloorX18 = lastFloorX18;
    }

    function bound(uint256 x, uint256 min, uint256 max) internal pure returns (uint256) {
        if (max <= min) return min;
        return min + (x % (max - min + 1));
    }
}
