// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

import {InkForkTestBase} from "./utils/InkForkTestBase.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";

/// @notice HKIT fair launch + buyback/burn on Ink fork.
contract ForkInkHkitBuybackTest is InkForkTestBase {
    using PoolIdLibrary for PoolKey;

    address internal hkit;
    PoolKey internal hkitKey;

    function setUp() public override {
        super.setUp();
        if (!forkReady) return;

        (,,, hkitKey) = HkitLaunchLib.fairLaunch(factory, distributor, hkitBuyback, "ipfs://hkit");
        hkit = distributor.nativeToken();
        nativeHook = hkit;
    }

    function testFork_HkitIsLaunchOne_EthPair() public onlyFork {
        assertEq(factory.launchCount(), 1);
        assertEq(Currency.unwrap(hkitKey.currency0), address(0));
        assertEq(Currency.unwrap(hkitKey.currency1), hkit);
        uint256 packed = hook.configs(hkitKey.toId());
        assertTrue(BitmaskConfig.enabled(packed, BitmaskConfig.ANTI_SNIPE_ENABLED));
        assertTrue(BitmaskConfig.enabled(packed, BitmaskConfig.ANTI_MEV_COOLDOWN_ENABLED));
        assertTrue(BitmaskConfig.enabled(packed, BitmaskConfig.LP_DONATE_ENABLED));
        assertFalse(BitmaskConfig.enabled(packed, BitmaskConfig.BACKED_FLOOR_ENABLED));
    }

    function testFork_HkitCreatorFeesGoToBuybackNotEscrow() public onlyFork {
        uint256 escrowBefore = escrow.balanceOf(deployer, Currency.wrap(address(0)));
        uint256 buybackPendingBefore = distributor.pendingBuyback(Currency.wrap(address(0)));

        _routerBuy(trader, hkitKey, hkit, 1 ether);

        assertEq(escrow.balanceOf(deployer, Currency.wrap(address(0))), escrowBefore);
        assertGt(distributor.pendingBuyback(Currency.wrap(address(0))), buybackPendingBefore);
        assertGt(distributor.pending(Currency.wrap(address(0))), 0);
    }

    function testFork_HkitBuybackExecuteBurnsSupply() public onlyFork {
        _routerBuy(trader, hkitKey, hkit, 2 ether);

        distributor.distribute(Currency.wrap(address(0)));
        distributor.flushBuybackEth();
        uint256 pot = distributor.buybackEth();
        assertGt(pot, 0);

        // HKIT ships with anti-MEV: one swap per tx.origin per pool per block (Foundry keeps
        // origin = this contract across pranks).
        vm.roll(block.number + 1);

        uint256 supplyBefore = IERC20(hkit).totalSupply();
        uint256 burned = hkitBuyback.execute(pot, 1);
        assertGt(burned, 0);
        assertLt(IERC20(hkit).totalSupply(), supplyBefore);
        assertEq(distributor.buybackEth(), 0);
    }

    function testFork_OtherTokenCreatorStillGetsEscrow() public onlyFork {
        InkForkTestBase.LaunchResult memory l = _launch(
            creator,
            Currency.wrap(address(0)),
            _defaultModules(),
            60,
            ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
            "Other",
            "OTH"
        );
        uint256 escrowBefore = escrow.balanceOf(creator, Currency.wrap(address(0)));
        _routerBuy(trader, l.key, l.token, 1 ether);
        assertGt(escrow.balanceOf(creator, Currency.wrap(address(0))), escrowBefore);
    }
}
