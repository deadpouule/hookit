// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {BalancedAggregator} from "../src/BalancedAggregator.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Deploy the PAIR-style balanced aggregator for `launchMulti` tokens on Ink.
contract DeployBalancedAggregatorInkScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        IPoolManager manager = IPoolManager(v4.poolManager);

        vm.startBroadcast(pk);
        BalancedAggregator aggregator = new BalancedAggregator(manager, factory);
        vm.stopBroadcast();

        console.log("BalancedAggregator", address(aggregator));
        console.log("LaunchFactory", address(factory));
    }
}
