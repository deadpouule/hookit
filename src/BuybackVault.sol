// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IBuybackVault} from "./interfaces/IBuybackVault.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @title BuybackVault
/// @notice Five-year linear vesting vault for optional creator buyback proceeds.
contract BuybackVault is Owned, UnlockTaker, IBuybackVault {
    using CurrencyLibrary for Currency;

    struct Stream {
        uint128 amount;
        uint64 start;
        uint128 claimed;
    }

    mapping(address => bool) public operators;
    mapping(address => mapping(Currency => Stream)) public streams;

    event OperatorSet(address indexed operator, bool allowed);
    event Credited(address indexed beneficiary, Currency indexed currency, uint256 amount);
    event Claimed(address indexed beneficiary, Currency indexed currency, uint256 amount);

    error NotOperator();
    error ZeroAmount();
    error NativeMismatch();
    error TransferFailed();
    error NothingVested();

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

    function credit(address beneficiary, Currency currency, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        if (currency.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            bool ok = IERC20Minimal(Currency.unwrap(currency)).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        }
        _credit(beneficiary, currency, amount);
    }

    function creditInternal(address beneficiary, Currency currency, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _credit(beneficiary, currency, amount);
    }

    function claim(Currency currency) external {
        uint256 vested = vestedOf(msg.sender, currency);
        if (vested == 0) revert NothingVested();
        streams[msg.sender][currency].claimed += uint128(vested);
        uint256 claims = address(claimsManager) == address(0)
            ? 0
            : claimsManager.balanceOf(address(this), currency.toId());
        if (claims >= vested) {
            _redeemClaims(currency, msg.sender, vested);
        } else {
            currency.transfer(msg.sender, vested);
        }
        emit Claimed(msg.sender, currency, vested);
    }

    function vestedOf(address account, Currency currency) public view returns (uint256) {
        Stream memory s = streams[account][currency];
        if (s.amount == 0 || s.start == 0) return 0;
        uint256 elapsed = block.timestamp - uint256(s.start);
        uint256 unlocked = elapsed >= ProtocolConstants.BUYBACK_VESTING_DURATION
            ? uint256(s.amount)
            : (uint256(s.amount) * elapsed) / ProtocolConstants.BUYBACK_VESTING_DURATION;
        if (unlocked <= s.claimed) return 0;
        return unlocked - s.claimed;
    }

    function _credit(address beneficiary, Currency currency, uint256 amount) private {
        Stream storage s = streams[beneficiary][currency];
        if (s.start == 0) s.start = uint64(block.timestamp);
        s.amount += uint128(amount);
        emit Credited(beneficiary, currency, amount);
    }
}
