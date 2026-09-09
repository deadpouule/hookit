// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {LaunchFactory} from "../src/LaunchFactory.sol";
import {IUniswapV3OraclePool, UniswapV3EthUsdTwapFeed} from "../src/UniswapV3EthUsdTwapFeed.sol";
import {QuotronStockQuotes} from "../src/libraries/QuotronStockQuotes.sol";

/// @notice Deploy and activate the guarded WETH/USDt0 TWAP feed on Ink.
contract DeployTwapOracleInkScript is Script {
    address internal constant POOL = 0x356667DA30C89cC36c65D394500424d5Eba8731c;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant USDT0 = 0x0200C29006150606B650577BBE7B6248F58470c1;

    function run() external {
        require(block.chainid == QuotronStockQuotes.INK_MAINNET, "Ink only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        LaunchFactory factory = LaunchFactory(payable(vm.envAddress("LAUNCH_FACTORY")));
        BondingLaunchFactory bonding = BondingLaunchFactory(payable(vm.envAddress("BONDING_FACTORY")));

        vm.startBroadcast(pk);
        UniswapV3EthUsdTwapFeed feed = new UniswapV3EthUsdTwapFeed(
            IUniswapV3OraclePool(POOL),
            WETH,
            USDT0,
            30 minutes,
            1 hours,
            300, // ~3.05% maximum spot/TWAP divergence
            1e16,
            100 ether,
            250_000e6
        );

        (, int256 answer,,,) = feed.latestRoundData();
        require(answer > 0, "TWAP unavailable");
        uint256 priceX18 = uint256(answer) * 1e10;

        factory.setEthUsdFeed(address(feed));
        factory.setEthUsdPrice(priceX18);
        bonding.setEthUsdPrice(priceX18, address(feed));
        vm.stopBroadcast();

        console.log("UniswapV3EthUsdTwapFeed", address(feed));
        console.log("ETH/USD x18", priceX18);
        console.log("TWAP_ORACLE_INK_OK");
    }
}
