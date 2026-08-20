// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Settle / take helpers for PoolManager deltas. Adapted from Uniswap v4-core test utils.
library CurrencySettler {
    function settle(Currency currency, IPoolManager manager, address payer, uint256 amount, bool burn) internal {
        if (amount == 0) return;
        if (burn) {
            manager.burn(payer, currency.toId(), amount);
        } else if (currency.isAddressZero()) {
            manager.settle{value: amount}();
        } else {
            manager.sync(currency);
            if (payer != address(this)) {
                IERC20Minimal(Currency.unwrap(currency)).transferFrom(payer, address(manager), amount);
            } else {
                IERC20Minimal(Currency.unwrap(currency)).transfer(address(manager), amount);
            }
            manager.settle();
        }
    }

    function take(Currency currency, IPoolManager manager, address recipient, uint256 amount, bool claims) internal {
        if (amount == 0) return;
        if (claims) {
            manager.mint(recipient, currency.toId(), amount);
        } else {
            manager.take(currency, recipient, amount);
        }
    }
}
