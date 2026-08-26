// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchFactory} from "../LaunchFactory.sol";
import {BondingLaunchFactory} from "../BondingLaunchFactory.sol";
import {QuotronStockQuotes} from "./QuotronStockQuotes.sol";
import {UniswapV4Deployments} from "./UniswapV4Deployments.sol";
import {ProtocolConstants} from "./ProtocolConstants.sol";

/// @title HookitDeployLib
/// @notice Shared post-deploy wiring for Base Sepolia (testnet) and Ink mainnet.
library HookitDeployLib {
    function seedQuotes(LaunchFactory factory) internal {
        UniswapV4Deployments.Deployment memory d = UniswapV4Deployments.get(block.chainid);
        factory.setQuote(d.stableQuote, true, 6, 1e18, address(0));
        factory.setEthUsdFeed(d.ethUsdFeed);
        try factory.syncEthUsdPrice() {} catch {}

        if (block.chainid == QuotronStockQuotes.INK_MAINNET) {
            QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
            for (uint256 i; i < stocks.length; ++i) {
                factory.setQuote(stocks[i].token, true, stocks[i].decimals, stocks[i].usdPriceX18, address(0));
            }
        }
    }

    /// @notice Mirror Master quote allowlist onto Classic bonding factory.
    function seedBondingQuotes(BondingLaunchFactory bonding) internal {
        UniswapV4Deployments.Deployment memory d = UniswapV4Deployments.get(block.chainid);
        bonding.setQuote(d.stableQuote, true, 6, 1e18, address(0));
        bonding.setEthUsdPrice(ProtocolConstants.DEFAULT_LAUNCH_ETH_USD_X18, d.ethUsdFeed);
        try bonding.syncEthUsdPrice() {} catch {}

        if (block.chainid == QuotronStockQuotes.INK_MAINNET) {
            QuotronStockQuotes.Listing[] memory stocks = QuotronStockQuotes.listings();
            for (uint256 i; i < stocks.length; ++i) {
                bonding.setQuote(stocks[i].token, true, stocks[i].decimals, stocks[i].usdPriceX18, address(0));
            }
        }
    }
}
