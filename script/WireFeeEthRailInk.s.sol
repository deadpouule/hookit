// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {FeeEthRail} from "../src/FeeEthRail.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {QuotronsInk} from "../src/libraries/QuotronsInk.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Wire `FeeEthRail` to a live public USDG↔ETH/WETH v4 pool on Ink (no empty seed).
/// @dev Usage:
///   FEE_ETH_RAIL=0x... forge script script/WireFeeEthRailInk.s.sol:WireFeeEthRailInk \
///     --rpc-url $INK_RPC_URL --broadcast
contract WireFeeEthRailInk is Script {
    function run() external {
        require(block.chainid == QuotronsInk.CHAIN_ID, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        FeeEthRail rail = FeeEthRail(payable(vm.envAddress("FEE_ETH_RAIL")));
        IPoolManager manager = IPoolManager(UniswapV4Deployments.get(block.chainid).poolManager);

        vm.startBroadcast(pk);
        bool wired = EthUsdgBridgeLib.tryWireBest(manager, rail);
        vm.stopBroadcast();

        if (wired) {
            console.log("FeeEthRail eth bridge wired");
            console.log("weth", rail.weth());
        } else {
            console.log("No public USDG/ETH or USDG/WETH v4 pool on Ink yet");
            console.log("wStock->USDG via Quotrons still works; ETH quote fees need no bridge");
            console.log("USDT0 mid (Quotrons pot):", QuotronsInk.USDT0);
        }
    }
}
