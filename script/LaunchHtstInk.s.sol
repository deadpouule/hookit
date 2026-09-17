// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {HktHolderDropVault} from "../src/HktHolderDropVault.sol";
import {HkitLaunchLib} from "../src/libraries/HkitLaunchLib.sol";
import {UniswapV4Deployments} from "../src/libraries/UniswapV4Deployments.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";
import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";

/// @notice Fair-launch $HTST on the live Ink factory with the documented native modules, then wire the flywheel.
/// @dev `forge script script/LaunchHtstInk.s.sol --rpc-url $INK_RPC_URL --broadcast --slow -vv`
contract LaunchHtstInkScript is Script {
    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        ProtocolRevenueDistributor distributor =
            ProtocolRevenueDistributor(payable(vm.envAddress("PROTOCOL_DISTRIBUTOR")));
        HkitBuyback buyback = HkitBuyback(payable(vm.envAddress("HKIT_BUYBACK")));
        HktHolderDropVault hktDrop = HktHolderDropVault(payable(vm.envAddress("HKT_HOLDER_DROP_VAULT")));
        address masterHook = vm.envAddress("MASTER_LAUNCH_HOOK");

        string memory nativeName = vm.envOr("NATIVE_TOKEN_NAME", string("HOOKTEST"));
        string memory nativeSymbol = vm.envOr("NATIVE_TOKEN_SYMBOL", string("HTST"));
        string memory nativeUri = vm.envOr("NATIVE_TOKEN_URI", string("ipfs://hooktest-native"));

        require(factory.launchCount() == 0, "factory already has launches");

        vm.startBroadcast(pk);
        (uint256 launchId, address token, PoolId poolId, PoolKey memory key) =
            HkitLaunchLib.fairLaunch(factory, distributor, buyback, nativeName, nativeSymbol, nativeUri);
        hktDrop.setHkt(token);
        address poolManager = UniswapV4Deployments.get(block.chainid).poolManager;
        hktDrop.setExcluded(poolManager, true);
        hktDrop.setExcluded(address(factory), true);
        hktDrop.setExcluded(masterHook, true);
        hktDrop.setExcluded(address(hktDrop), true);
        vm.stopBroadcast();

        uint256 packed = BitmaskConfig.pack(HkitLaunchLib.defaultModules());
        console.log("=== HTST fair launch (Ink) ===");
        console.log("launchId", launchId);
        console.log("NativeToken", token);
        console.logBytes32(PoolId.unwrap(poolId));
        console.log("antiSnipe", BitmaskConfig.enabled(packed, BitmaskConfig.ANTI_SNIPE_ENABLED));
        console.log("antiMev", BitmaskConfig.enabled(packed, BitmaskConfig.ANTI_MEV_COOLDOWN_ENABLED));
        console.log("creatorShareToHook", BitmaskConfig.enabled(packed, BitmaskConfig.CREATOR_SHARE_TO_HOOK_ENABLED));
        console.log("autoBurn", BitmaskConfig.enabled(packed, BitmaskConfig.AUTO_BURN_ENABLED));
        console.log("deepenLps", BitmaskConfig.enabled(packed, BitmaskConfig.DEEPEN_LPS_ENABLED));
        console.log("autoBurnBps", uint256(HkitLaunchLib.defaultModules().autoBurnBps));
        console.log("deepenLpsBps", uint256(HkitLaunchLib.defaultModules().deepenLpsBps));
        console.log("pool fee", key.fee);
        console.log("distributor native", distributor.nativeToken());
        console.log("ENV_NEXT_PUBLIC_NATIVE_TOKEN", token);
        console.log("ENV_NATIVE_TOKEN_LAUNCH_ID", launchId);
        console.log("LAUNCH_HTST_INK_OK");
    }
}
