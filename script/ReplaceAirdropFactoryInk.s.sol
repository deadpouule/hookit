// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookMiner} from "../src/libraries/HookMiner.sol";
import {MasterLaunchHook} from "../src/MasterLaunchHook.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {LaunchFactoryQuery} from "../src/LaunchFactoryQuery.sol";
import {FloorVault} from "../src/FloorVault.sol";
import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {BuybackVault} from "../src/BuybackVault.sol";
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Patch deploy: new HolderAirdropVault + MasterLaunchHook + LaunchFactory.
///         Reuses live FloorVault / FeeEscrow / Distributor / BuybackVault.
///         Existing tokens stay on the old hook/vault; new launches use the patched vault.
///
///   export PRIVATE_KEY=...          # owner of the live vaults (0x67B4…)
///   forge script script/ReplaceAirdropFactoryInk.s.sol:ReplaceAirdropFactoryInkScript \
///     --rpc-url $INK_RPC_URL --broadcast --slow -vvvv
contract ReplaceAirdropFactoryInkScript is Script {
    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);

        FloorVault vault =
            FloorVault(payable(vm.envOr("FLOOR_VAULT", address(0x6BECBba50416a8A0B747D2FB2d1CDC4b8213c8F9))));
        FeeEscrow escrow =
            FeeEscrow(payable(vm.envOr("FEE_ESCROW", address(0x40699bcE8fA85B0E551260c2bb45E6A4011c1Aa4))));
        ProtocolRevenueDistributor distributor = ProtocolRevenueDistributor(
            payable(vm.envOr("DISTRIBUTOR", address(0x10d0350B143B40509C7c5461d66Ba28C5AD4b24F)))
        );
        BuybackVault buybacks =
            BuybackVault(payable(vm.envOr("BUYBACK_VAULT", address(0x00c478D5a25eb496C34A3D82Af266606206C8589))));

        require(vault.owner() == deployer, "not vault owner");
        require(escrow.owner() == deployer, "not escrow owner");

        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        IPoolManager manager = IPoolManager(v4.poolManager);

        vm.startBroadcast(pk);

        HolderAirdropVault airdrops = new HolderAirdropVault(deployer, manager);

        uint160 masterFlags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        bytes memory masterArgs = abi.encode(manager, vault, escrow, distributor, buybacks, airdrops, deployer);
        (address masterPredicted, bytes32 masterSalt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, masterFlags, type(MasterLaunchHook).creationCode, masterArgs);
        MasterLaunchHook hook =
            new MasterLaunchHook{salt: masterSalt}(manager, vault, escrow, distributor, buybacks, airdrops, deployer);
        require(address(hook) == masterPredicted, "master hook mismatch");

        LaunchFactory factory = new LaunchFactory(manager, hook, deployer, ops);
        HookitDeployLib.seedQuotes(factory);
        LaunchFactoryQuery launchQuery = new LaunchFactoryQuery(factory);

        hook.setFactory(address(factory));
        vault.setOperator(address(hook), true);
        escrow.setOperator(address(hook), true);
        distributor.setOperator(address(hook), true);
        buybacks.setOperator(address(hook), true);
        airdrops.setOperator(address(hook), true);

        vm.stopBroadcast();

        console.log("=== Airdrop vault + factory patch (Ink) ===");
        console.log("HolderAirdropVault", address(airdrops));
        console.log("MasterLaunchHook", address(hook));
        console.log("LaunchFactory", address(factory));
        console.log("LaunchFactoryQuery", address(launchQuery));
        console.log("ENV_NEXT_PUBLIC_LAUNCH_FACTORY", address(factory));
        console.log("ENV_NEXT_PUBLIC_LAUNCH_FACTORY_QUERY", address(launchQuery));
        console.log("REDEPLOY_AIRDROP_OK");
    }
}
