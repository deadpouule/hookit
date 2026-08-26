// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {MockQuoteToken} from "../test/mocks/MockQuoteToken.sol";

/// @notice Deploys mock xStock-style quotes on Base Sepolia and registers them on the factory.
/// @dev Real stock quotes on Ink are Quotrons wrapped equities (`QuotronStockQuotes`). Sepolia uses `MockQuoteToken` stand-ins.
contract DeploySepoliaStockQuotesScript is Script {
    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));

        vm.startBroadcast(pk);
        MockQuoteToken aapl = new MockQuoteToken("Apple", "AAPLc", 18);
        MockQuoteToken nvda = new MockQuoteToken("NVIDIA", "NVDAc", 18);
        MockQuoteToken tsla = new MockQuoteToken("Tesla", "TSLAc", 18);
        factory.setQuote(address(aapl), true, 18, 200e18, address(0));
        factory.setQuote(address(nvda), true, 18, 120e18, address(0));
        factory.setQuote(address(tsla), true, 18, 250e18, address(0));
        vm.stopBroadcast();

        console.log("AAPLc", address(aapl));
        console.log("NVDAc", address(nvda));
        console.log("TSLAc", address(tsla));
    }
}
