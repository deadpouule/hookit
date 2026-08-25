// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BaseSepoliaAddresses} from "../src/libraries/BaseSepoliaAddresses.sol";

/// @notice Deploys Hookit core contracts on Base Sepolia (no smoke launch — lower ETH cost).
contract DeployHookitCoreScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);
        IPoolManager manager = IPoolManager(BaseSepoliaAddresses.POOL_MANAGER);

        vm.startBroadcast(pk);

        FloorVault vault = new FloorVault(deployer, manager);
        FeeEscrow escrow = new FeeEscrow(deployer, manager);
        ProtocolRevenueDistributor distributor = new ProtocolRevenueDistributor(deployer, ops, manager);
        BuybackVault buybacks = new BuybackVault(deployer, manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        bytes memory ctorArgs = abi.encode(manager, vault, escrow, distributor, buybacks, deployer);
        (address predicted, bytes32 salt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, flags, type(MasterLaunchHook).creationCode, ctorArgs);

        MasterLaunchHook hook = new MasterLaunchHook{salt: salt}(manager, vault, escrow, distributor, buybacks, deployer);
        require(address(hook) == predicted, "hook address mismatch");

        LaunchFactory factory = new LaunchFactory(manager, hook, deployer, ops);
        factory.setEthUsdFeed(BaseSepoliaAddresses.CHAINLINK_ETH_USD);
        try factory.syncEthUsdPrice() {} catch {}
        HookitSwapRouter router = new HookitSwapRouter(manager);

        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        vault.setOperator(address(distributor), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);

        LaunchToken nativeToken = new LaunchToken("Hookit", "HOOK", 1_000_000_000e18, deployer, deployer, "");
        distributor.setNativeToken(address(nativeToken), vault);
        vault.setOperator(address(distributor), true);

        vm.stopBroadcast();

        console.log("FloorVault", address(vault));
        console.log("FeeEscrow", address(escrow));
        console.log("Distributor", address(distributor));
        console.log("BuybackVault", address(buybacks));
        console.log("MasterLaunchHook", address(hook));
        console.log("LaunchFactory", address(factory));
        console.log("HookitSwapRouter", address(router));
        console.log("Native HOOK", address(nativeToken));
    }
}
