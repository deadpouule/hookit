// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

interface IFeeEscrow {
    function credit(address account, Currency currency, uint256 amount) external payable;
    function claim(Currency currency) external;
    function claimAll(Currency[] calldata currencies) external;
    function balanceOf(address account, Currency currency) external view returns (uint256);
}
