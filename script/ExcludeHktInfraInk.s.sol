// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {HktHolderDropVault} from "../src/HktHolderDropVault.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Exclude LP / factory / protocol sinks from global HTST holder airdrop weights.
/// @dev Run once after fair launch + hktDrop.setHkt:
///      forge script script/ExcludeHktInfraInk.s.sol --rpc-url $INK_RPC_URL --broadcast -vv
contract ExcludeHktInfraInkScript is Script {
    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        HktHolderDropVault vault = HktHolderDropVault(payable(vm.envAddress("HKT_HOLDER_DROP_VAULT")));

        address[] memory accounts = new address[](12);
        accounts[0] = vm.envAddress("POOL_MANAGER");
        accounts[1] = vm.envAddress("LAUNCH_FACTORY");
        accounts[2] = vm.envAddress("MASTER_LAUNCH_HOOK");
        accounts[3] = vm.envAddress("BONDING_FACTORY");
        accounts[4] = address(vault);
        accounts[5] = vm.envAddress("PROTOCOL_DISTRIBUTOR");
        accounts[6] = vm.envAddress("HKIT_BUYBACK");
        accounts[7] = vm.envAddress("FLOOR_VAULT");
        accounts[8] = vm.envAddress("FEE_ESCROW");
        accounts[9] = vm.envAddress("HOLDER_AIRDROP_VAULT");
        accounts[10] = vm.envAddress("BUYBACK_VAULT");
        accounts[11] = vm.envAddress("GRADUATED_FEE_HOOK");

        vm.startBroadcast(pk);
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] == address(0)) continue;
            vault.setExcluded(accounts[i], true);
            console.log("excluded", accounts[i]);
        }
        vm.stopBroadcast();

        console.log("holderCount", vault.holderCount());
        console.log("EXCLUDE_HKT_INFRA_OK");
    }
}
