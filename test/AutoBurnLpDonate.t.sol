// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract AutoBurnLpDonateTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function testAutoBurnReducesSupply() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.autoBurn = true;
        m.autoBurnBps = 5_000;
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 supplyBefore = LaunchTokenLike(token).totalSupply();
        buyExactIn(key, 10 ether);
        uint256 supplyAfter = LaunchTokenLike(token).totalSupply();

        assertLt(supplyAfter, supplyBefore);
        assertEq(LaunchTokenLike(token).balanceOf(address(hook)), 0);
        assertEq(hook.pendingAutoBurn(poolId), 0);
    }

    function testLpDonateAccruesFeeGrowth() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.lpDonate = true;
        m.lpDonateBps = 5_000;
        (, , PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        buyExactIn(key, 5 ether);
        (uint256 growth0, uint256 growth1) = manager.getFeeGrowthGlobals(poolId);
        assertTrue(growth0 > 0 || growth1 > 0);
        assertEq(hook.pendingLpDonate(poolId), 0);
        key;
    }

    function testAutoBurnAndLpDonateTogether() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.autoBurn = true;
        m.lpDonate = true;
        m.autoBurnBps = 2_000;
        m.lpDonateBps = 2_000;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 supplyBefore = LaunchTokenLike(token).totalSupply();
        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 10 ether);

        assertLt(LaunchTokenLike(token).totalSupply(), supplyBefore);
        assertGt(escrow.balanceOf(address(this), Currency.wrap(address(0))), creatorBefore);
    }
}
