// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchFactory} from "../LaunchFactory.sol";
import {XStockQuotes} from "./XStockQuotes.sol";
import {UniswapV4Deployments} from "./UniswapV4Deployments.sol";

/// @title HookitDeployLib
/// @notice Shared post-deploy wiring for Base Sepolia (testnet) and Ink mainnet.
library HookitDeployLib {
    function seedQuotes(LaunchFactory factory) internal {
        UniswapV4Deployments.Deployment memory d = UniswapV4Deployments.get(block.chainid);
        factory.setQuote(d.stableQuote, true, 6, 1e18, address(0));
        factory.setEthUsdFeed(d.ethUsdFeed);
        try factory.syncEthUsdPrice() {} catch {}

        if (block.chainid == XStockQuotes.INK_MAINNET) {
            XStockQuotes.Listing[] memory xstocks = XStockQuotes.listings();
            for (uint256 i; i < xstocks.length; ++i) {
                factory.setQuote(xstocks[i].token, true, xstocks[i].decimals, xstocks[i].usdPriceX18, address(0));
            }
        }
    }
}
