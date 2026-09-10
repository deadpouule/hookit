// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

interface IBuybackVault {
    function credit(address beneficiary, address launchToken, Currency currency, uint256 amount, uint64 durationSeconds)
        external
        payable;

    function configurePlan(address launchToken, uint128 slice) external;
    function observeFdv(address launchToken, uint256 fdvUsd) external;
    function claim(address launchToken) external;
    function vestedOf(address account, address launchToken) external view returns (uint256);
}
