// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Optional: push bootstrap snapshots as fallback if Quotrons pools are down.
/// @dev Live sizing prefers Quotrons V4 `sqrtPriceX96` on-chain. Update `usdPriceX18` from
///      GET https://api.xstocks.fi/api/v2/public/assets/{symbol}/price-data?network=Ink
///      only as offline backup.
contract SeedQuotronStockQuotesScript is Script {
    function run() public {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink mainnet only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
        vm.startBroadcast(pk);
        for (uint256 i; i < stocks.length; ++i) {
            factory.setQuote(stocks[i].token, true, stocks[i].decimals, stocks[i].usdPriceX18, address(0));
        }
        vm.stopBroadcast();

        console.log("Seeded", stocks.length, "Quotrons wStock quotes");
    }
}
