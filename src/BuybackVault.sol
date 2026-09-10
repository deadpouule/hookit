// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IBuybackVault} from "./interfaces/IBuybackVault.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {McapVest} from "./libraries/McapVest.sol";
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
    /// Primary stream (first currency credited for this beneficiary/token).
    mapping(address => mapping(address => Stream)) public streams;
    /// Extra streams when a multi-market launch credits a second quote.
    mapping(address => mapping(address => mapping(uint256 => Stream))) private _extra;
    mapping(address => mapping(address => address[])) private _extraCurrencies;
    /// Packed `McapVest.Plan` for this launch token. 0 = linear time vest.
    mapping(address => uint128) public vestSlice;
    /// Highest observed fully-diluted USD (whole dollars) for mcap unlocks.
    mapping(address => uint256) public highWaterFdvUsd;

    event OperatorSet(address indexed operator, bool allowed);
    event VestPlanSet(address indexed launchToken, uint128 slice);
    event FdvObserved(address indexed launchToken, uint256 fdvUsd);
    event Credited(address indexed beneficiary, address indexed launchToken, Currency indexed currency, uint256 amount);
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

    /// @notice Set the mcap cliff / step plan. No-op when `slice == 0` (time vest).
    function configurePlan(address launchToken, uint128 slice) external onlyOperator {
        if (launchToken == address(0)) revert ZeroAddress();
        if (slice == 0) return;
        McapVest.Plan memory p = McapVest.unpack(slice);
        McapVest.validate(p, true);
        vestSlice[launchToken] = slice;
        emit VestPlanSet(launchToken, slice);
    }

    function observeFdv(address launchToken, uint256 fdvUsd) external onlyOperator {
        if (fdvUsd <= highWaterFdvUsd[launchToken]) return;
        highWaterFdvUsd[launchToken] = fdvUsd;
        emit FdvObserved(launchToken, fdvUsd);
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
        uint256 paid = _payoutStream(streams[msg.sender][launchToken], msg.sender, launchToken);
        address[] storage extras = _extraCurrencies[msg.sender][launchToken];
        for (uint256 i; i < extras.length; ++i) {
            paid += _payoutStream(
                _extra[msg.sender][launchToken][Currency.wrap(extras[i]).toId()], msg.sender, launchToken
            );
        }
        if (paid == 0) revert NothingVested();
    }

    function vestedOf(address account, address launchToken) public view returns (uint256) {
        uint256 total = _vested(streams[account][launchToken], launchToken);
        address[] storage extras = _extraCurrencies[account][launchToken];
        for (uint256 i; i < extras.length; ++i) {
            total += _vested(_extra[account][launchToken][Currency.wrap(extras[i]).toId()], launchToken);
        }
        return total;
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
            s.durationSeconds =
                durationSeconds == 0 ? uint64(ProtocolConstants.BUYBACK_VESTING_DURATION) : durationSeconds;
            s.amount += uint128(amount);
            emit Credited(beneficiary, launchToken, currency, amount);
            return;
        }
        if (Currency.unwrap(s.currency) == Currency.unwrap(currency)) {
            s.amount += uint128(amount);
            emit Credited(beneficiary, launchToken, currency, amount);
            return;
        }

        Stream storage extra = _extra[beneficiary][launchToken][currency.toId()];
        if (extra.start == 0) {
            extra.start = uint64(block.timestamp);
            extra.currency = currency;
            extra.durationSeconds =
                durationSeconds == 0 ? uint64(ProtocolConstants.BUYBACK_VESTING_DURATION) : durationSeconds;
            _extraCurrencies[beneficiary][launchToken].push(Currency.unwrap(currency));
        }
        extra.amount += uint128(amount);
        emit Credited(beneficiary, launchToken, currency, amount);
    }

    function _vested(Stream storage s, address launchToken) private view returns (uint256) {
        if (s.amount == 0 || s.start == 0) return 0;
        uint128 slice = vestSlice[launchToken];
        if (slice != 0) {
            McapVest.Plan memory p = McapVest.unpack(slice);
            if (p.kind == McapVest.KIND_CLIFF || p.kind == McapVest.KIND_STEPS) {
                uint16 bps = McapVest.unlockedBps(p, highWaterFdvUsd[launchToken]);
                uint256 unlocked = uint256(s.amount) * uint256(bps) / ProtocolConstants.BPS_DENOMINATOR;
                if (unlocked <= s.claimed) return 0;
                return unlocked - s.claimed;
            }
        }
        uint256 duration = s.durationSeconds == 0 ? ProtocolConstants.BUYBACK_VESTING_DURATION : s.durationSeconds;
        uint256 elapsed = block.timestamp - uint256(s.start);
        uint256 unlockedTime = elapsed >= duration ? uint256(s.amount) : (uint256(s.amount) * elapsed) / duration;
        if (unlockedTime <= s.claimed) return 0;
        return unlockedTime - s.claimed;
    }

    function _payoutStream(Stream storage s, address beneficiary, address launchToken)
        private
        returns (uint256 vested)
    {
        vested = _vested(s, launchToken);
        if (vested == 0) return 0;
        s.claimed += uint128(vested);

        uint256 claims =
            address(claimsManager) == address(0) ? 0 : claimsManager.balanceOf(address(this), s.currency.toId());
        uint256 fromClaims = claims >= vested ? vested : claims;
        if (fromClaims > 0) _redeemClaims(s.currency, beneficiary, fromClaims);
        uint256 remainder = vested - fromClaims;
        if (remainder > 0) s.currency.transfer(beneficiary, remainder);
        emit Claimed(beneficiary, launchToken, s.currency, vested);
    }
}
