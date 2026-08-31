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
import {HolderAirdropVault} from "../src/HolderAirdropVault.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {HookitDeployLib} from "../src/libraries/HookitDeployLib.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {EthUsdgBridgeLib} from "../src/libraries/EthUsdgBridgeLib.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

/// @notice Resume Ink deploy after partial `DeployHookitCore` (stops before Chainlink sync on some RPC paths).
contract ResumeDeployHookitInkScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address ops = vm.envOr("OPS_TREASURY", deployer);
        string memory nativeName = vm.envOr("NATIVE_TOKEN_NAME", string("HOOKTEST"));
        string memory nativeSymbol = vm.envOr("NATIVE_TOKEN_SYMBOL", string("HTST"));
        string memory nativeUri = vm.envOr("NATIVE_TOKEN_URI", string("ipfs://hooktest-native"));

        UniswapV4Deployments.Deployment memory v4 = UniswapV4Deployments.get(block.chainid);
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        IPoolManager manager = IPoolManager(v4.poolManager);

        FloorVault vault = FloorVault(payable(vm.envAddress("FLOOR_VAULT")));
        FeeEscrow escrow = FeeEscrow(payable(vm.envAddress("FEE_ESCROW")));
        ProtocolRevenueDistributor distributor = ProtocolRevenueDistributor(payable(vm.envAddress("DISTRIBUTOR")));
        BuybackVault buybacks = BuybackVault(payable(vm.envAddress("BUYBACK_VAULT")));
        HolderAirdropVault airdrops = HolderAirdropVault(payable(vm.envAddress("HOLDER_AIRDROP_VAULT")));
        MasterLaunchHook hook = MasterLaunchHook(payable(vm.envAddress("MASTER_LAUNCH_HOOK")));
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        vm.startBroadcast(pk);

        // Finish Master quote allowlist (USDG + feed already set on partial deploy).
        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        for (uint256 i; i < stocks.length; ++i) {
            factory.setQuote(stocks[i].token, true, stocks[i].decimals, stocks[i].usdPriceX18, address(0));
        }

        uint160 gradFlags =
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        bytes memory gradArgs = abi.encode(manager, escrow, distributor, deployer);
        (address gradPredicted, bytes32 gradSalt) =
            HookMiner.find(HookMiner.CREATE2_DEPLOYER, gradFlags, type(GraduatedFeeHook).creationCode, gradArgs);
        GraduatedFeeHook graduated = new GraduatedFeeHook{salt: gradSalt}(manager, escrow, distributor, deployer);
        require(address(graduated) == gradPredicted, "graduated hook mismatch");

        BondingLaunchFactory bonding = new BondingLaunchFactory(manager, graduated, escrow, distributor, deployer, ops);
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
        airdrops.setOperator(address(hook), true);
        distributor.setFeeRail(feeRail);
        EthUsdgBridgeLib.tryWireBest(manager, feeRail);

        (uint256 launchId, address nativeToken, PoolId poolId, PoolKey memory key) =
            HkitLaunchLib.fairLaunch(factory, distributor, hkitBuyback, nativeName, nativeSymbol, nativeUri);

        vm.stopBroadcast();

        console.log("LaunchFactory", address(factory));
        console.log("GraduatedFeeHook", address(graduated));
        console.log("BondingLaunchFactory", address(bonding));
        console.log("HookitSwapRouter", address(router));
        console.log("FeeEthRail", address(feeRail));
        console.log("HkitBuyback", address(hkitBuyback));
        console.log("NativeToken", nativeToken);
        console.log("NativeToken launchId", launchId);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("RESUME_OK");
    }
}
