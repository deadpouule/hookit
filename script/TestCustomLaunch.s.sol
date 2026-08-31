// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Launches a token bound to a custom hook (bitmask = 0).
contract TestCustomLaunchScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("LAUNCH_FACTORY");
        address customHookAddr = vm.envAddress("CUSTOM_HOOK");

        LaunchFactory factory = LaunchFactory(payable(factoryAddr));

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId) = factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Custom Hook Demo",
                symbol: "CHD",
                metadataURI: "ipfs://hookit-custom-hook-demo",
                totalSupply: ProtocolConstants.DEFAULT_LAUNCH_SUPPLY,
                quote: Currency.wrap(address(0)),
                tickSpacing: ProtocolConstants.DEFAULT_TICK_SPACING,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(customHookAddr),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        vm.stopBroadcast();

        console.log("Launch id", launchId);
        console.log("Token", token);
        console.log("Custom hook", customHookAddr);
        console.logBytes32(PoolId.unwrap(poolId));
    }
}
