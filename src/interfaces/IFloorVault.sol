// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

interface IFloorVault {
    function deposit(address token, Currency quote, uint256 amount) external payable;
    function drawForFloor(address token, Currency quote, uint256 tokenAmount, address recipient)
        external
        returns (uint256 quoteOut);
    function redeemFloor(address token, uint256 tokenAmount) external returns (uint256 quoteOut);
    function reserve(address token) external view returns (uint256);
    function quoteOf(address token) external view returns (Currency);
    function floorPriceX18(address token) external view returns (uint256);
}
