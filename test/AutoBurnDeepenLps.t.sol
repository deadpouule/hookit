// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract AutoBurnDeepenLpsTest is LaunchpadTestBase {
    using StateLibrary for IPoolManager;

    function setUp() public {
        deployProtocol();
    }

    function testAutoBurnReducesSupply() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 500;
        m.autoBurn = true;
        m.autoBurnBps = 10_000;
        (, address token, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 supplyBefore = LaunchTokenLike(token).totalSupply();
        buyExactIn(key, 10 ether);
        uint256 supplyAfter = LaunchTokenLike(token).totalSupply();

        assertLt(supplyAfter, supplyBefore);
        assertEq(LaunchTokenLike(token).balanceOf(address(hook)), 0);
        assertEq(hook.pendingAutoBurn(poolId), 0);
    }

    function testLpDeepenIncreasesInRangeLiquidity() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 500;
        m.deepenLps = true;
        m.deepenLpsBps = 10_000;
        (,, PoolId poolId, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint128 seed = hook.launchState(poolId).seedLiquidity;
        buyExactIn(key, 5 ether);
        uint128 inRange = manager.getLiquidity(poolId);
        assertEq(hook.pendingDeepenLps(poolId), 0);
        assertGt(inRange, seed);
        key;
    }

    function testAutoBurnAndDeepenLpsTogether() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 400;
        m.autoBurn = true;
        m.deepenLps = true;
        m.autoBurnBps = 5_000;
        m.deepenLpsBps = 5_000;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);

        uint256 supplyBefore = LaunchTokenLike(token).totalSupply();
        uint256 creatorBefore = escrow.balanceOf(address(this), Currency.wrap(address(0)));
        buyExactIn(key, 10 ether);

        assertLt(LaunchTokenLike(token).totalSupply(), supplyBefore);
        assertGt(escrow.balanceOf(address(this), Currency.wrap(address(0))), creatorBefore);
    }
}
