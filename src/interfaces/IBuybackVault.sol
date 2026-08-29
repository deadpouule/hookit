// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

interface IBuybackVault {
    function credit(address beneficiary, address launchToken, Currency currency, uint256 amount, uint64 durationSeconds)
        external
        payable;
    function claim(address launchToken) external;
    function vestedOf(address account, address launchToken) external view returns (uint256);
}
