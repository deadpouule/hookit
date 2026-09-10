// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ILaunchQuotes
/// @notice Minimal factory surface so the hook can size USD FDV without importing LaunchFactory.
interface ILaunchQuotes {
    function quoteUsdPriceX18(address token) external view returns (uint256);
    function quoteConfigs(address token)
        external
        view
        returns (bool allowed, uint8 decimals, uint256 usdPriceX18, address usdFeed);
}
