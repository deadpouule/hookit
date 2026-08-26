// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {HookitSwapRouter} from "../src/HookitSwapRouter.sol";
import {FeeEthRail} from "../src/FeeEthRail.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Deploys Hookit dual-rail (Master + Classic) + fair-launches HKIT.
contract DeployHookitCoreScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);
        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        IPoolManager manager = IPoolManager(v4.poolManager);

        vm.startBroadcast(pk);

        FloorVault vault = new FloorVault(deployer, manager);
        FeeEscrow escrow = new FeeEscrow(deployer, manager);
        ProtocolRevenueDistributor distributor = new ProtocolRevenueDistributor(deployer, ops, manager);
        BuybackVault buybacks = new BuybackVault(deployer, manager);

        uint160 masterFlags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory masterArgs = abi.encode(manager, vault, escrow, distributor, buybacks, deployer);
        (address masterPredicted, bytes32 masterSalt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, masterFlags, type(MasterLaunchHook).creationCode, masterArgs);
        MasterLaunchHook hook =
            new MasterLaunchHook{salt: masterSalt}(manager, vault, escrow, distributor, buybacks, deployer);
        require(address(hook) == masterPredicted, "master hook mismatch");

        LaunchFactory factory = new LaunchFactory(manager, hook, deployer, ops);
        HookitDeployLib.seedQuotes(factory);

        uint160 gradFlags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory gradArgs = abi.encode(manager, escrow, distributor, deployer);
        (address gradPredicted, bytes32 gradSalt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, gradFlags, type(GraduatedFeeHook).creationCode, gradArgs);
        GraduatedFeeHook graduated =
            new GraduatedFeeHook{salt: gradSalt}(manager, escrow, distributor, deployer);
        require(address(graduated) == gradPredicted, "graduated hook mismatch");

        BondingLaunchFactory bonding =
            new BondingLaunchFactory(manager, graduated, escrow, distributor, deployer, ops);
        graduated.setFactory(address(bonding));
        HookitDeployLib.seedBondingQuotes(bonding);

        HookitSwapRouter router = new HookitSwapRouter(manager);
        FeeEthRail feeRail = new FeeEthRail(deployer, manager, v4.stableQuote);
        HkitBuyback hkitBuyback = new HkitBuyback(deployer, manager, distributor);

        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        vault.setOperator(address(distributor), true);
        escrow.setOperator(address(hook), true);
        escrow.setOperator(address(bonding), true);
        escrow.setOperator(address(graduated), true);
        distributor.setOperator(address(hook), true);
        distributor.setOperator(address(bonding), true);
        distributor.setOperator(address(graduated), true);
        buybacks.setOperator(address(hook), true);
        distributor.setFeeRail(feeRail);
        EthUsdgBridgeLib.tryWireBest(manager, feeRail);

        (uint256 launchId, address hkit, PoolId poolId, PoolKey memory key) =
            HkitLaunchLib.fairLaunch(factory, distributor, hkitBuyback, "ipfs://hookit-hkit");

        vm.stopBroadcast();

        console.log("FloorVault", address(vault));
        console.log("FeeEscrow", address(escrow));
        console.log("Distributor", address(distributor));
        console.log("BuybackVault", address(buybacks));
        console.log("MasterLaunchHook", address(hook));
        console.log("LaunchFactory", address(factory));
        console.log("GraduatedFeeHook", address(graduated));
        console.log("BondingLaunchFactory", address(bonding));
        console.log("LiquidityLocker", address(bonding.locker()));
        console.log("HookitSwapRouter", address(router));
        console.log("FeeEthRail", address(feeRail));
        console.log("FeeEthRail bridge set", feeRail.ethBridgeSet());
        console.log("HkitBuyback", address(hkitBuyback));
        console.log("HKIT", hkit);
        console.log("HKIT launchId", launchId);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("HKIT pool fee", key.fee);
        console.log("launch fee wei", ProtocolConstants.LAUNCH_FEE_WEI);
    }
}
