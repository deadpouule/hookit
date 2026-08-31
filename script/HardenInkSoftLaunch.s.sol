// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice One-shot soft-launch hardening on the **live** Ink factory (owner only).
/// @dev Blocks permissionless custom Solidity hooks by enabling the allowlist (no hooks allowlisted).
///      UI also sets `CUSTOM_SOLIDITY_HOOKS_ENABLED=false`.
///      `forge script script/HardenInkSoftLaunch.s.sol --rpc-url $INK_RPC_URL --broadcast`
contract HardenInkSoftLaunchScript is Script {
    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        bool allowlist = factory.customHookAllowlistEnabled();
        console.log("LaunchFactory", address(factory));
        console.log("customHookAllowlistEnabled before", allowlist);

        if (allowlist) {
            console.log("Already hardened - nothing to do");
            console.log("HARDEN_INK_OK");
            return;
        }

        vm.startBroadcast(pk);
        factory.setCustomHookAllowlistEnabled(true);
        vm.stopBroadcast();

        require(factory.customHookAllowlistEnabled(), "allowlist not set");
        console.log("customHookAllowlistEnabled after", true);
        console.log("HARDEN_INK_OK");
    }
}
