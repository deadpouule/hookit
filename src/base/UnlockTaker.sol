// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

/// @notice Redeems PoolManager ERC-6909 claims into ERC20/native via a nested unlock.
abstract contract UnlockTaker is IUnlockCallback {
    IPoolManager public immutable claimsManager;

    error NotClaimsManager();

    constructor(IPoolManager manager_) {
        claimsManager = manager_;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(claimsManager)) revert NotClaimsManager();
        (Currency currency, address to, uint256 amount) = abi.decode(data, (Currency, address, uint256));
        claimsManager.burn(address(this), currency.toId(), amount);
        claimsManager.take(currency, to, amount);
        return "";
    }

    function _redeemClaims(Currency currency, address to, uint256 amount) internal {
        if (amount == 0) return;
        claimsManager.unlock(abi.encode(currency, to, amount));
    }
}
