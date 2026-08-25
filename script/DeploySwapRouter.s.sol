// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Deploys the production swap router against the live PoolManager.
contract DeploySwapRouterScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        IPoolManager manager = IPoolManager(v4.poolManager);

        vm.startBroadcast(pk);
        HookitSwapRouter router = new HookitSwapRouter(manager);
        vm.stopBroadcast();

        console.log("HookitSwapRouter", address(router));
    }
}
