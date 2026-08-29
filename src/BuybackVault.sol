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
/// @notice Linear vesting vault for optional creator buyback proceeds (per launch token).
contract BuybackVault is Owned, UnlockTaker, IBuybackVault {
    using CurrencyLibrary for Currency;

    struct Stream {
        Currency currency;
        uint128 amount;
        uint64 start;
        uint128 claimed;
        uint64 durationSeconds;
    }

    mapping(address => bool) public operators;
    mapping(address => mapping(address => Stream)) public streams;

    event OperatorSet(address indexed operator, bool allowed);
    event Credited(
        address indexed beneficiary, address indexed launchToken, Currency indexed currency, uint256 amount
    );
    event Claimed(address indexed beneficiary, address indexed launchToken, Currency indexed currency, uint256 amount);

    error NotOperator();
    error ZeroAddress();
    error ZeroAmount();
    error NativeMismatch();
    error TransferFailed();
    error NothingVested();
    error CurrencyMismatch();

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

    function credit(address beneficiary, address launchToken, Currency currency, uint256 amount, uint64 durationSeconds)
        external
        payable
        onlyOperator
    {
        if (beneficiary == address(0) || launchToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (currency.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            bool ok = IERC20Minimal(Currency.unwrap(currency)).transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        }
        _credit(beneficiary, launchToken, currency, amount, durationSeconds);
    }

    function creditInternal(
        address beneficiary,
        address launchToken,
        Currency currency,
        uint256 amount,
        uint64 durationSeconds
    ) external onlyOperator {
        if (beneficiary == address(0) || launchToken == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _credit(beneficiary, launchToken, currency, amount, durationSeconds);
    }

    function claim(address launchToken) external {
        uint256 vested = vestedOf(msg.sender, launchToken);
        if (vested == 0) revert NothingVested();

        Stream storage s = streams[msg.sender][launchToken];
        s.claimed += uint128(vested);

        uint256 claims = address(claimsManager) == address(0)
            ? 0
            : claimsManager.balanceOf(address(this), s.currency.toId());
        if (claims >= vested) {
            _redeemClaims(s.currency, msg.sender, vested);
        } else {
            s.currency.transfer(msg.sender, vested);
        }
        emit Claimed(msg.sender, launchToken, s.currency, vested);
    }

    function vestedOf(address account, address launchToken) public view returns (uint256) {
        Stream memory s = streams[account][launchToken];
        if (s.amount == 0 || s.start == 0) return 0;
        uint256 duration = s.durationSeconds == 0 ? ProtocolConstants.BUYBACK_VESTING_DURATION : s.durationSeconds;
        uint256 elapsed = block.timestamp - uint256(s.start);
        uint256 unlocked = elapsed >= duration ? uint256(s.amount) : (uint256(s.amount) * elapsed) / duration;
        if (unlocked <= s.claimed) return 0;
        return unlocked - s.claimed;
    }

    function _credit(
        address beneficiary,
        address launchToken,
        Currency currency,
        uint256 amount,
        uint64 durationSeconds
    ) private {
        Stream storage s = streams[beneficiary][launchToken];
        if (s.start == 0) {
            s.start = uint64(block.timestamp);
            s.currency = currency;
            s.durationSeconds = durationSeconds == 0 ? uint64(ProtocolConstants.BUYBACK_VESTING_DURATION) : durationSeconds;
        } else if (Currency.unwrap(s.currency) != Currency.unwrap(currency)) {
            revert CurrencyMismatch();
        }
        s.amount += uint128(amount);
        emit Credited(beneficiary, launchToken, currency, amount);
    }
}
