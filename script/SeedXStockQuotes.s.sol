// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {XStockQuotes} from "../src/libraries/XStockQuotes.sol";

/// @notice Refreshes xStock USD prices on the factory (bootstrap snapshots from `XStockQuotes`).
/// @dev For live prices, update `usdPriceX18` values from
///      GET https://api.xstocks.fi/api/v2/public/assets/{symbol}/price-data?network=Ink
///      before broadcasting, or run an off-chain keeper that calls `setQuote`.
contract SeedXStockQuotesScript is Script {
    function run() public {
        require(block.chainid == XStockQuotes.INK_MAINNET, "Ink mainnet only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        XStockQuotes.Listing[] memory xstocks = XStockQuotes.listings();
        vm.startBroadcast(pk);
        for (uint256 i; i < xstocks.length; ++i) {
            factory.setQuote(xstocks[i].token, true, xstocks[i].decimals, xstocks[i].usdPriceX18, address(0));
        }
        vm.stopBroadcast();

        console.log("Seeded", xstocks.length, "xStock quotes");
    }
}
