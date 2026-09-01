// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";

/// @title V4ClaimsRedeemer
/// @notice Redeems Uniswap v4 PoolManager ERC-6909 quote claims into spendable native/ERC20.
/// @dev Callers must `setOperator(redeemer, true)` on the PoolManager once, or approve per currency id.
contract V4ClaimsRedeemer is IUnlockCallback {
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;

    event Claimed(address indexed account, Currency indexed currency, uint256 amount);

    error NotPoolManager();
    error ZeroAmount();
    error TransferFailed();

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function claimable(address account, Currency currency) external view returns (uint256) {
        return poolManager.balanceOf(account, currency.toId());
    }

    /// @notice Redeems the caller's full ERC-6909 balance for `currency`.
    function claim(Currency currency) external returns (uint256 amount) {
        uint256 id = currency.toId();
        amount = poolManager.balanceOf(msg.sender, id);
        if (amount == 0) revert ZeroAmount();
        _claim(msg.sender, currency, id, amount);
        return amount;
    }

    /// @notice Redeems up to `amount` of the caller's ERC-6909 balance for `currency`.
    function claim(Currency currency, uint256 amount) external returns (uint256 redeemed) {
        uint256 id = currency.toId();
        uint256 bal = poolManager.balanceOf(msg.sender, id);
        if (amount == 0 || bal == 0) revert ZeroAmount();
        redeemed = amount > bal ? bal : amount;
        _claim(msg.sender, currency, id, redeemed);
        return redeemed;
    }

    function _claim(address account, Currency currency, uint256 id, uint256 amount) private {
        poolManager.unlock(abi.encode(account, currency, id, amount));
        emit Claimed(account, currency, amount);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (address account, Currency currency, uint256 id, uint256 amount) =
            abi.decode(data, (address, Currency, uint256, uint256));
        bool ok = poolManager.transferFrom(account, address(this), id, amount);
        if (!ok) revert TransferFailed();
        poolManager.burn(address(this), id, amount);
        poolManager.take(currency, account, amount);
        return "";
    }
}
