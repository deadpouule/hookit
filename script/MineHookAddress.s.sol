// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";

/// @notice Mines a CREATE2 salt so MasterLaunchHook encodes the required v4 permission flags.
contract MineHookAddressScript is Script {
    function run() public {
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        address poolManager = v4.poolManager;
        address deployer = vm.envOr("HOOK_DEPLOYER", HookMiner.CREATE2_DEPLOYER);
        address owner = vm.envOr("OPS_TREASURY", address(this));

        // Placeholder vault addresses — mine after those are known, or pass via env.
        address vault = vm.envOr("FLOOR_VAULT", address(0));
        address escrow = vm.envOr("FEE_ESCROW", address(0));
        address distributor = vm.envOr("DISTRIBUTOR", address(0));
        address buybacks = vm.envOr("BUYBACK_VAULT", address(0));

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );

        bytes memory ctorArgs = abi.encode(
            IPoolManager(poolManager),
            FloorVault(payable(vault)),
            FeeEscrow(payable(escrow)),
            ProtocolRevenueDistributor(payable(distributor)),
            BuybackVault(payable(buybacks)),
            owner
        );

        (address hookAddress, bytes32 salt) =
            HookMiner.find(deployer, flags, type(MasterLaunchHook).creationCode, ctorArgs);

        console.log("MasterLaunchHook flags", flags);
        console.log("CREATE2 deployer", deployer);
        console.log("Mined hook address", hookAddress);
        console.logBytes32(salt);
    }
}
