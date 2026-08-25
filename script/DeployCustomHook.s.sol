// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {HookitCustomHook} from "../src/examples/HookitCustomHook.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Mines and deploys `HookitCustomHook` on the active v4 chain.
contract DeployCustomHookScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        IPoolManager manager = IPoolManager(v4.poolManager);

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG);

        bytes memory ctorArgs = abi.encode(manager);
        (address predicted, bytes32 salt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, flags, type(HookitCustomHook).creationCode, ctorArgs);

        vm.startBroadcast(pk);
        HookitCustomHook hook = new HookitCustomHook{salt: salt}(manager);
        vm.stopBroadcast();

        require(address(hook) == predicted, "hook address mismatch");
        console.log("HookitCustomHook", address(hook));
        console.logBytes32(salt);
    }
}
