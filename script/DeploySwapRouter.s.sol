// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {BaseSepoliaAddresses} from "../src/libraries/BaseSepoliaAddresses.sol";

/// @notice Deploys the production swap router against the live Base Sepolia PoolManager.
contract DeploySwapRouterScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager manager = IPoolManager(BaseSepoliaAddresses.POOL_MANAGER);

        vm.startBroadcast(pk);
        HookitSwapRouter router = new HookitSwapRouter(manager);
        vm.stopBroadcast();

        console.log("HookitSwapRouter", address(router));
    }
}
