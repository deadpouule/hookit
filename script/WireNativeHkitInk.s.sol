// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {HkitBuyback} from "../src/HkitBuyback.sol";
import {HktHolderDropVault} from "../src/HktHolderDropVault.sol";
import {IFloorVault} from "../src/interfaces/IFloorVault.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Point distributor + buyback + HKT drop at the live HTST fair launch on the current factory.
/// @dev `forge script script/WireNativeHkitInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv`
contract WireNativeHkitInkScript is Script {
    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address nativeToken = vm.envAddress("NATIVE_TOKEN");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        ProtocolRevenueDistributor distributor =
            ProtocolRevenueDistributor(payable(vm.envAddress("PROTOCOL_DISTRIBUTOR")));
        HkitBuyback buyback = HkitBuyback(payable(vm.envAddress("HKIT_BUYBACK")));
        HktHolderDropVault hktDrop = HktHolderDropVault(payable(vm.envAddress("HKT_HOLDER_DROP_VAULT")));

        uint256 launchId = vm.envOr("NATIVE_TOKEN_LAUNCH_ID", uint256(1));
        require(nativeToken.code.length > 0, "native token missing");

        uint256 onChainLaunchId = factory.tokenLaunchId(nativeToken);
        require(onChainLaunchId == launchId, "NATIVE_TOKEN_LAUNCH_ID mismatch");

        PoolKey memory poolKey = factory.poolKeyOf(launchId);

        console.log("nativeToken", nativeToken);
        console.log("launchId", launchId);
        console.log("distributor before", distributor.nativeToken());
        console.log("buyback hkit before", buyback.hkit());

        vm.startBroadcast(pk);

        distributor.setNativeToken(nativeToken, IFloorVault(address(0)));
        distributor.setFlywheelMode(ProtocolRevenueDistributor.FlywheelMode.BuybackBurn);
        buyback.configure(nativeToken, poolKey);
        distributor.setBuybackExecutor(address(buyback));
        hktDrop.setHkt(nativeToken);

        address poolManager = vm.envAddress("POOL_MANAGER");
        hktDrop.setExcluded(poolManager, true);
        hktDrop.setExcluded(address(factory), true);
        hktDrop.setExcluded(vm.envAddress("MASTER_LAUNCH_HOOK"), true);
        hktDrop.setExcluded(address(hktDrop), true);

        vm.stopBroadcast();

        console.log("distributor after", distributor.nativeToken());
        console.log("buyback configured", buyback.configured());
        console.log("buyback hkit after", buyback.hkit());
        console.log("WIRE_NATIVE_HKIT_OK");
    }
}
