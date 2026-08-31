// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IFeeEscrow} from "./interfaces/IFeeEscrow.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @title FeeEscrow
/// @notice Pull-over-push multi-currency fee accounting for creators and protocol parties.
contract FeeEscrow is Owned, UnlockTaker, IFeeEscrow {
    using CurrencyLibrary for Currency;

    mapping(address => bool) public operators;
    mapping(address => mapping(Currency => uint256)) public override balanceOf;

    event OperatorSet(address indexed operator, bool allowed);
    event Credited(address indexed account, Currency indexed currency, uint256 amount);
    event Claimed(address indexed account, Currency indexed currency, uint256 amount);

    error NotOperator();
    error ZeroAmount();
    error NativeMismatch();
    error TransferFailed();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert NotOperator();
        _;
    }

    constructor(address owner_, IPoolManager manager_) Owned(owner_) UnlockTaker(manager_) {}

    receive() external payable {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    /// @inheritdoc IFeeEscrow
    function credit(address account, Currency currency, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        if (currency.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            _safeTransferFrom(Currency.unwrap(currency), msg.sender, address(this), amount);
        }
        balanceOf[account][currency] += amount;
        emit Credited(account, currency, amount);
    }

    /// @dev Credits an account using funds already held by this contract (used by the hook after `take`).
    function creditInternal(address account, Currency currency, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        balanceOf[account][currency] += amount;
        emit Credited(account, currency, amount);
    }

    function claim(Currency currency) external {
        uint256 amount = balanceOf[msg.sender][currency];
        if (amount == 0) revert ZeroAmount();
        balanceOf[msg.sender][currency] = 0;
        _payout(msg.sender, currency, amount);
        emit Claimed(msg.sender, currency, amount);
    }

    function claimAll(Currency[] calldata currencies) external {
        uint256 len = currencies.length;
        for (uint256 i; i < len; ++i) {
            uint256 amount = balanceOf[msg.sender][currencies[i]];
            if (amount == 0) continue;
            balanceOf[msg.sender][currencies[i]] = 0;
            _payout(msg.sender, currencies[i], amount);
            emit Claimed(msg.sender, currencies[i], amount);
        }
    }

    function _payout(address to, Currency currency, uint256 amount) private {
        uint256 claims =
            address(claimsManager) == address(0) ? 0 : claimsManager.balanceOf(address(this), currency.toId());
        if (claims >= amount) {
            _redeemClaims(currency, to, amount);
        } else {
            currency.transfer(to, amount);
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20Minimal(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
