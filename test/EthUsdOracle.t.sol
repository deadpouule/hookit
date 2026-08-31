// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {LaunchFactory} from "../src/LaunchFactory.sol";
import {LaunchpadTestBase} from "./utils/LaunchpadTestBase.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";

contract MockEthUsdFeed {
    int256 public answer;
    uint8 public decimals_ = 8;
    uint256 public updatedAt;

    constructor(int256 answer_, uint256 updatedAt_) {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function decimals() external view returns (uint8) {
        return decimals_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, 0, updatedAt, 1);
    }
}

contract EthUsdOracleTest is LaunchpadTestBase {
    function test_syncEthUsdPriceScalesEightDecimals() public {
        deployProtocol();
        MockEthUsdFeed feed = new MockEthUsdFeed(3_500e8, block.timestamp);
        factory.setEthUsdFeed(address(feed));
        factory.syncEthUsdPrice();
        assertEq(factory.ethUsdPriceX18(), 3_500e18);
    }

    function test_unknownQuoteReverts() public {
        deployProtocol();
        vm.expectRevert(LaunchFactory.InvalidQuote.selector);
        factory.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            LaunchFactory.LaunchParams({
                name: "Bad",
                symbol: "BAD",
                metadataURI: "",
                totalSupply: 1_000_000_000e18,
                quote: Currency.wrap(address(0xBEEF)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: 0,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }
}
