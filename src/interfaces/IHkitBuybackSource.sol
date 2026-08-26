// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IHkitBuybackSource
/// @notice ETH buyback pot interface used by `HkitBuyback`.
interface IHkitBuybackSource {
    function flushBuybackEth() external returns (uint256 flushed);
    function pullBuybackEth(uint256 amount) external returns (uint256 pulled);
    function returnBuybackEth() external payable;
    function buybackEth() external view returns (uint256);
}
