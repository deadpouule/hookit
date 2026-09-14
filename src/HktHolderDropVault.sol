// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Owned} from "./base/Owned.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {IHolderAirdropSync} from "./interfaces/IHolderAirdropSync.sol";
import {IHktHolderDropVault} from "./interfaces/IHktHolderDropVault.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @title HktHolderDropVault
/// @notice Accrues launched tokens (the meme, not $HKT) and pushes them pro-rata to live $HKT holders.
/// @dev Holder set is global ($HKT balances). Permissionless `syncHolders` plus LaunchToken tracker sync.
///      Amount is proportional to live $HKT `balanceOf` at payout. Batched per epoch — never paid inside every swap.
contract HktHolderDropVault is Owned, IHolderAirdropSync, IHktHolderDropVault {
    uint256 internal constant MAX_HOLDERS_PER_PUSH = 48;

    struct PendingDrop {
        uint256 pot;
        uint256 totalHkt;
        uint256 cursor;
        uint256 paid;
        uint256 listed;
        /// Epoch generation this payout belongs to (see `_snapEpoch`).
        uint64 epoch;
    }

    address public override hkt;
    mapping(address => bool) public operators;
    mapping(address => bool) public excluded;
    mapping(address => uint256) public reserve;
    mapping(address => uint64) public lastDropAt;
    uint32 public epochSeconds = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;

    address[] private _holders;
    mapping(address => uint256) private _holderIndex;
    mapping(address => PendingDrop) private _pending;
    /// Last $HKT balance seen for each listed holder and their running sum, so an epoch starts in
    /// O(1) instead of reading every holder's balance inside `beforeSwap` of every Master pool.
    mapping(address => uint256) private _trackedBal;
    uint256 public listedTotal;
    /// Epoch generation plus the number of token payouts currently in flight; overlapping payouts
    /// share one generation so their snapshots stay consistent.
    uint64 public epochGeneration;
    uint256 private _activePayouts;
    /// Lazy snapshot: the first time a holder's balance moves during a live epoch, the pre-move
    /// balance is frozen. Payouts use min(live, frozen) so $HKT moved between batches is not paid twice.
    mapping(address => uint64) private _snapEpoch;
    mapping(address => uint256) private _snapBal;
    uint256 private _locked = 1;

    event OperatorSet(address indexed operator, bool allowed);
    event HktSet(address indexed token);
    event ExcludedSet(address indexed account, bool excluded);
    event EpochConfigured(uint32 epochSeconds);
    event HolderSynced(address indexed account, bool listed);
    event Credited(address indexed token, uint256 amount, uint256 newReserve);
    event Dropped(address indexed token, uint256 pot, uint256 distributed, uint256 holders, address caller);

    error NotOperator();
    error NotHkt();
    error NoHkt();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error TransferFailed();
    error EpochTooShort();
    error EpochTooLong();
    error Reentrant();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert NotOperator();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrant();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address owner_) Owned(owner_) {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setHkt(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        hkt = token;
        emit HktSet(token);
    }

    function setExcluded(address account, bool isExcluded) external onlyOperator {
        if (excluded[account] == isExcluded) return;
        excluded[account] = isExcluded;
        if (isExcluded) _removeHolder(account);
        else _sync(account);
        emit ExcludedSet(account, isExcluded);
    }

    function configureEpoch(uint32 seconds_) external onlyOwner {
        if (seconds_ == 0) seconds_ = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;
        if (seconds_ < ProtocolConstants.MIN_HOLDER_AIRDROP_EPOCH_SECONDS) revert EpochTooShort();
        if (seconds_ > ProtocolConstants.MAX_HOLDER_AIRDROP_EPOCH_SECONDS) revert EpochTooLong();
        epochSeconds = seconds_;
        emit EpochConfigured(seconds_);
    }

    function holderList() external view returns (address[] memory) {
        return _holders;
    }

    function holderCount() external view returns (uint256) {
        return _holders.length;
    }

    function potOf(address token) external view returns (uint256) {
        return reserve[token];
    }

    function secondsUntilDrop(address token) external view returns (uint256) {
        uint64 last = lastDropAt[token];
        if (last == 0) return 0;
        uint256 next = uint256(last) + epochSeconds;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    /// @inheritdoc IHolderAirdropSync
    function syncHolder(address token, address account) external {
        if (msg.sender != hkt || token != hkt) revert NotHkt();
        _sync(account);
    }

    /// @notice Permissionless: add wallets with live $HKT, drop those at 0.
    function syncHolders(address[] calldata accounts) external {
        if (hkt == address(0)) revert NoHkt();
        for (uint256 i; i < accounts.length; ++i) {
            _sync(accounts[i]);
        }
    }

    function creditInternal(address token, uint256 amount) external onlyOperator {
        if (token == address(0) || amount == 0) revert ZeroAmount();
        reserve[token] += amount;
        uint256 bal = IERC20Balance(token).balanceOf(address(this));
        if (bal < reserve[token]) revert InsufficientBalance();
        emit Credited(token, amount, reserve[token]);
    }

    function tryPush(address token) external nonReentrant returns (bool) {
        if (hkt == address(0)) revert NoHkt();
        uint256 potNow = reserve[token];
        if (potNow == 0) return false;

        uint64 last = lastDropAt[token];
        if (last != 0 && block.timestamp < uint256(last) + epochSeconds) return false;
        if (_holders.length == 0) return false;

        PendingDrop storage pending = _pending[token];
        if (pending.pot == 0) {
            uint256 total = listedTotal;
            if (total == 0) return false;
            pending.pot = potNow;
            pending.totalHkt = total;
            pending.cursor = 0;
            pending.listed = _holders.length;
            pending.paid = 0;
            if (_activePayouts == 0) ++epochGeneration;
            ++_activePayouts;
            pending.epoch = epochGeneration;
        }

        uint256 listed = pending.listed;
        if (listed > _holders.length) listed = _holders.length;

        uint256 remainingPot = pending.pot - pending.paid;
        if (remainingPot == 0) {
            _finishEpoch(token, pending);
            return true;
        }

        uint256 batchStart = pending.cursor;
        uint256 batchEnd = batchStart + MAX_HOLDERS_PER_PUSH;
        if (batchEnd > listed) batchEnd = listed;

        uint256 newCursor = batchStart;
        uint256 batchPaid;

        for (uint256 i = batchStart; i < batchEnd; ++i) {
            newCursor = i + 1;
            if (remainingPot == 0) {
                newCursor = i;
                break;
            }
            address account = _holders[i];
            uint256 bal = _payableBalance(account, pending.epoch);
            if (bal == 0) continue;
            uint256 share = pending.pot * bal / pending.totalHkt;
            if (share == 0) continue;
            if (share > remainingPot) share = remainingPot;
            if (share == 0) {
                newCursor = i;
                break;
            }
            reserve[token] -= share;
            _safeTransfer(token, account, share);
            batchPaid += share;
            remainingPot -= share;
        }

        pending.cursor = newCursor;
        if (batchPaid > 0) pending.paid += batchPaid;

        if (pending.cursor < listed && remainingPot > 0) return false;
        if (pending.paid == 0) {
            _dropPending(token);
            return false;
        }

        _finishEpoch(token, pending);
        return true;
    }

    /// @notice Recover balances that are not part of any pot (e.g. tokens sent here by mistake).
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 free = IERC20Balance(token).balanceOf(address(this)) - reserve[token];
        if (amount == 0 || amount > free) revert InsufficientBalance();
        _safeTransfer(token, to, amount);
    }

    function _dropPending(address token) private {
        if (_pending[token].epoch != 0) --_activePayouts;
        delete _pending[token];
    }

    function _track(address account, uint256 bal) private {
        uint256 prev = _trackedBal[account];
        if (bal == prev) return;
        if (_activePayouts != 0 && _snapEpoch[account] != epochGeneration) {
            _snapEpoch[account] = epochGeneration;
            _snapBal[account] = prev;
        }
        listedTotal = listedTotal - prev + bal;
        _trackedBal[account] = bal;
    }

    function _payableBalance(address account, uint64 gen) private view returns (uint256 bal) {
        bal = IERC20Balance(hkt).balanceOf(account);
        uint256 cap = _snapEpoch[account] == gen ? _snapBal[account] : _trackedBal[account];
        if (cap < bal) bal = cap;
    }

    function _sync(address account) private {
        if (account == address(0) || hkt == address(0)) return;
        if (excluded[account]) {
            _removeHolder(account);
            return;
        }

        uint256 bal = IERC20Balance(hkt).balanceOf(account);
        uint256 idx = _holderIndex[account];
        if (bal > 0 && idx == 0) {
            _holders.push(account);
            _holderIndex[account] = _holders.length;
            emit HolderSynced(account, true);
        } else if (bal == 0 && idx > 0) {
            _removeHolder(account);
            return;
        }
        _track(account, bal);
    }

    function _removeHolder(address account) private {
        uint256 idx = _holderIndex[account];
        if (idx == 0) return;

        uint256 lastIdx = _holders.length;
        if (idx != lastIdx) {
            address moved = _holders[lastIdx - 1];
            _holders[idx - 1] = moved;
            _holderIndex[moved] = idx;
        }
        _holders.pop();
        _holderIndex[account] = 0;
        _track(account, 0);
        emit HolderSynced(account, false);
    }

    function _finishEpoch(address token, PendingDrop storage pending) private {
        emit Dropped(token, pending.pot, pending.paid, _holders.length, msg.sender);
        _dropPending(token);
        lastDropAt[token] = uint64(block.timestamp);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
