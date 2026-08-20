// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

interface IProtocolRevenueDistributor {
    function notify(Currency currency, uint256 amount) external payable;
    function distribute(Currency currency) external;
    function opsTreasury() external view returns (address);
    function nativeToken() external view returns (address);
}
