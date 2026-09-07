// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {IHolderAirdropSync} from "./interfaces/IHolderAirdropSync.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @title HolderAirdropVault
/// @notice Accrues quote-only launch fees and pushes them pro-rata to on-chain tracked holders each epoch.
/// @dev LaunchToken maintains the holder set; the next swap after epoch elapsed triggers batched payout.
contract HolderAirdropVault is Owned, UnlockTaker, IHolderAirdropSync {
    using CurrencyLibrary for Currency;

    uint256 internal constant MAX_HOLDERS_PER_SWAP = 48;

    struct PendingAirdrop {
        uint256 pot;
        uint256 totalBal;
        uint256 cursor;
        uint256 paid;
        uint256 listed;
    }

    mapping(address => bool) public operators;
    mapping(address => uint256) public reserve;
    mapping(address => mapping(uint256 => uint256)) public reserveByQuote;
    mapping(address => Currency) public quoteOf;
    mapping(address => uint64) public lastAirdropAt;
    mapping(address => mapping(uint256 => uint64)) public lastAirdropAtQuote;
    mapping(address => uint32) public epochSeconds;
    mapping(address => mapping(address => bool)) public excluded;
    mapping(address => address[]) private _excludeList;
    mapping(address => address[]) private _holders;
    mapping(address => mapping(address => uint256)) private _holderIndex;
    mapping(address => mapping(uint256 => PendingAirdrop)) private _pending;
    uint256 private _locked = 1;

    event OperatorSet(address indexed operator, bool allowed);
    event ExcludedSet(address indexed token, address indexed account, bool excluded);
    event EpochConfigured(address indexed token, uint32 epochSeconds);
    event HolderSynced(address indexed token, address indexed account, bool listed);
    event Deposited(address indexed token, Currency indexed quote, uint256 amount, uint256 newReserve);
    event Airdropped(
        address indexed token, Currency indexed quote, uint256 pot, uint256 distributed, uint256 holders, address caller
    );

    error NotOperator();
    error NotToken();
    error ZeroAmount();
    error QuoteMismatch();
    error EpochNotElapsed();
    error EmptyHolders();
    error IncompleteHolderSet();
    error DuplicateHolder();
    error ExcludedHolder();
    error NativeMismatch();
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

    constructor(address owner_, IPoolManager manager_) Owned(owner_) UnlockTaker(manager_) {}

    receive() external payable {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setExcluded(address token, address account, bool isExcluded) external onlyOperator {
        if (excluded[token][account] == isExcluded) return;
        excluded[token][account] = isExcluded;
        if (isExcluded) {
            _excludeList[token].push(account);
            _removeHolder(token, account);
        } else {
            address[] storage list = _excludeList[token];
            for (uint256 i; i < list.length; ++i) {
                if (list[i] == account) {
                    list[i] = list[list.length - 1];
                    list.pop();
                    break;
                }
            }
            _syncBalance(token, account);
        }
        emit ExcludedSet(token, account, isExcluded);
    }

    function excludeList(address token) external view returns (address[] memory) {
        return _excludeList[token];
    }

    function holderList(address token) external view returns (address[] memory) {
        return _holders[token];
    }

    function holderCount(address token) external view returns (uint256) {
        return _holders[token].length;
    }

    /// @dev Backwards-compatible alias for indexers.
    function registeredHolderCount(address token) external view returns (uint256) {
        return _holders[token].length;
    }

    /// @inheritdoc IHolderAirdropSync
    function syncHolder(address token, address account) external {
        if (msg.sender != token) revert NotToken();
        _syncBalance(token, account);
    }

    function _syncBalance(address token, address account) private {
        if (account == address(0)) return;
        if (excluded[token][account]) {
            _removeHolder(token, account);
            return;
        }

        uint256 bal = IERC20Balance(token).balanceOf(account);
        uint256 idx = _holderIndex[token][account];
        if (bal > 0 && idx == 0) {
            _holders[token].push(account);
            _holderIndex[token][account] = _holders[token].length;
            emit HolderSynced(token, account, true);
        } else if (bal == 0 && idx > 0) {
            _removeHolder(token, account);
        }
    }

    function configureEpoch(address token, uint32 seconds_) external onlyOperator {
        if (seconds_ == 0) seconds_ = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;
        if (seconds_ < ProtocolConstants.MIN_HOLDER_AIRDROP_EPOCH_SECONDS) revert EpochTooShort();
        if (seconds_ > ProtocolConstants.MAX_HOLDER_AIRDROP_EPOCH_SECONDS) revert EpochTooLong();
        epochSeconds[token] = seconds_;
        emit EpochConfigured(token, seconds_);
    }

    function depositInternal(address token, Currency quote, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);
        _addPot(token, quote, amount);
        emit Deposited(token, quote, amount, _pot(token, quote));
    }

    function deposit(address token, Currency quote, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);

        if (quote.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            _safeTransferFrom(Currency.unwrap(quote), msg.sender, address(this), amount);
        }

        _addPot(token, quote, amount);
        emit Deposited(token, quote, amount, _pot(token, quote));
    }

    function potOf(address token, Currency quote) public view returns (uint256) {
        return _pot(token, quote);
    }

    function tryAutoAirdrop(address token) external nonReentrant returns (bool) {
        return _tryAutoAirdrop(token, quoteOf[token]);
    }

    function tryAutoAirdrop(address token, Currency quote) external nonReentrant returns (bool) {
        return _tryAutoAirdrop(token, quote);
    }

    /// @dev Claims-only. Never unlocks — safe to call from `_beforeSwap`.
    function _tryAutoAirdrop(address token, Currency quote) private returns (bool) {
        uint256 potNow = _pot(token, quote);
        if (potNow == 0) return false;

        uint64 last = _lastAt(token, quote);
        uint32 epoch = epochSeconds[token];
        if (epoch == 0) epoch = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;
        if (last != 0 && block.timestamp < uint256(last) + epoch) return false;

        address[] storage holders = _holders[token];
        if (holders.length == 0) return false;

        uint256 quoteId = quote.toId();
        uint256 claimsBal = address(claimsManager) != address(0) ? claimsManager.balanceOf(address(this), quoteId) : 0;
        if (claimsBal == 0) return false;

        PendingAirdrop storage pending = _pending[token][quoteId];
        if (pending.pot == 0) {
            pending.pot = potNow;
            pending.totalBal = _sumListedBalances(token, holders);
            if (pending.totalBal == 0) return false;
            pending.cursor = 0;
            pending.listed = holders.length;
            pending.paid = 0;
        }

        uint256 listed = pending.listed;
        if (listed > holders.length) listed = holders.length;

        uint256 remainingPot = pending.pot - pending.paid;
        if (remainingPot == 0) {
            _finishEpoch(token, quote, pending, holders.length);
            return true;
        }

        uint256 batchStart = pending.cursor;
        uint256 batchEnd = batchStart + MAX_HOLDERS_PER_SWAP;
        if (batchEnd > listed) batchEnd = listed;

        address[] memory payees = new address[](batchEnd > batchStart ? batchEnd - batchStart : 0);
        uint256[] memory shares = new uint256[](payees.length);
        uint256 payCount;
        uint256 batchPaid;
        uint256 claimsLeft = claimsBal;
        uint256 newCursor = batchStart;

        for (uint256 i = batchStart; i < batchEnd; ++i) {
            newCursor = i + 1;
            if (remainingPot == 0 || claimsLeft == 0) {
                newCursor = i;
                break;
            }
            address account = holders[i];
            uint256 bal = IERC20Balance(token).balanceOf(account);
            if (bal == 0) continue;
            uint256 share = pending.pot * bal / pending.totalBal;
            if (share == 0) continue;
            if (share > remainingPot) share = remainingPot;
            if (share > claimsLeft) share = claimsLeft;
            if (share == 0) {
                newCursor = i;
                break;
            }
            payees[payCount] = account;
            shares[payCount] = share;
            batchPaid += share;
            remainingPot -= share;
            claimsLeft -= share;
            unchecked {
                ++payCount;
            }
        }

        if (batchPaid == 0 && claimsLeft == claimsBal) {
            newCursor = batchEnd;
        }
        pending.cursor = newCursor;

        if (batchPaid > 0) {
            pending.paid += batchPaid;
            _subPot(token, quote, batchPaid);
            for (uint256 i; i < payCount; ++i) {
                claimsManager.transfer(payees[i], quoteId, shares[i]);
            }
        }

        if (pending.cursor < listed && remainingPot > 0) return false;

        bool done = pending.paid > 0;
        _finishEpoch(token, quote, pending, holders.length);
        return done;
    }

    /// @notice Manual full-list airdrop (legacy / emergency). Prefer automatic `tryAutoAirdrop`.
    /// @dev May redeem claims (unlock) — call outside of a swap.
    function airdrop(address token, address[] calldata holders) external nonReentrant returns (uint256 distributed) {
        Currency quote = quoteOf[token];
        uint256 pot = _pot(token, quote);
        if (pot == 0) revert ZeroAmount();

        uint64 last = _lastAt(token, quote);
        uint32 epoch = epochSeconds[token];
        if (epoch == 0) epoch = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;
        if (last != 0 && block.timestamp < uint256(last) + epoch) revert EpochNotElapsed();
        if (holders.length == 0) revert EmptyHolders();

        uint256 circulating = _circulatingSupply(token);
        (uint256 totalBal, uint256[] memory bals) = _validateHolders(token, holders, circulating);

        uint256 claimsBal =
            address(claimsManager) != address(0) ? claimsManager.balanceOf(address(this), quote.toId()) : 0;

        uint256[] memory shares = new uint256[](holders.length);
        uint256 paid;
        for (uint256 i; i < holders.length; ++i) {
            uint256 share = pot * bals[i] / totalBal;
            shares[i] = share;
            paid += share;
        }

        _subPot(token, quote, paid);
        delete _pending[token][quote.toId()];
        lastAirdropAtQuote[token][quote.toId()] = uint64(block.timestamp);
        lastAirdropAt[token] = uint64(block.timestamp);
        distributed = paid;

        if (claimsBal >= pot) {
            for (uint256 i; i < holders.length; ++i) {
                if (shares[i] == 0) continue;
                claimsManager.transfer(holders[i], quote.toId(), shares[i]);
            }
        } else {
            _materializeQuote(quote, pot);
            for (uint256 i; i < holders.length; ++i) {
                if (shares[i] == 0) continue;
                quote.transfer(holders[i], shares[i]);
            }
        }

        emit Airdropped(token, quote, pot, distributed, holders.length, msg.sender);
    }

    function secondsUntilAirdrop(address token) external view returns (uint256) {
        return _secondsUntil(_lastAt(token, quoteOf[token]), epochSeconds[token]);
    }

    function secondsUntilAirdrop(address token, Currency quote) external view returns (uint256) {
        return _secondsUntil(_lastAt(token, quote), epochSeconds[token]);
    }

    function _removeHolder(address token, address account) private {
        uint256 idx = _holderIndex[token][account];
        if (idx == 0) return;

        address[] storage list = _holders[token];
        uint256 lastIdx = list.length;
        // Swap-and-pop; when the account is already last there is nothing to move
        // (indexing `list[idx - 1]` after the pop would panic out of bounds).
        if (idx != lastIdx) {
            address moved = list[lastIdx - 1];
            list[idx - 1] = moved;
            _holderIndex[token][moved] = idx;
        }
        list.pop();
        _holderIndex[token][account] = 0;
        emit HolderSynced(token, account, false);
    }

    function _sumListedBalances(address token, address[] storage holders) private view returns (uint256 total) {
        for (uint256 i; i < holders.length; ++i) {
            total += IERC20Balance(token).balanceOf(holders[i]);
        }
    }

    function _circulatingSupply(address token) private view returns (uint256 circulating) {
        circulating = IERC20Balance(token).totalSupply();
        address[] storage excl = _excludeList[token];
        for (uint256 i; i < excl.length; ++i) {
            circulating -= IERC20Balance(token).balanceOf(excl[i]);
        }
    }

    function _validateHolders(address token, address[] calldata holders, uint256 circulating)
        private
        view
        returns (uint256 totalBal, uint256[] memory bals)
    {
        bals = new uint256[](holders.length);
        for (uint256 i; i < holders.length; ++i) {
            address account = holders[i];
            if (excluded[token][account]) revert ExcludedHolder();
            for (uint256 j; j < i; ++j) {
                if (holders[j] == account) revert DuplicateHolder();
            }
            uint256 bal = IERC20Balance(token).balanceOf(account);
            bals[i] = bal;
            totalBal += bal;
        }
        if (totalBal != circulating) revert IncompleteHolderSet();
        if (totalBal == 0) revert EmptyHolders();
    }

    function _bindQuote(address token, Currency quote) private {
        Currency stored = quoteOf[token];
        if (Currency.unwrap(stored) == address(0) && reserve[token] == 0 && lastAirdropAt[token] == 0) {
            quoteOf[token] = quote;
        }
    }

    function _uninitialized(address token) private view returns (bool) {
        return Currency.unwrap(quoteOf[token]) == address(0) && reserve[token] == 0 && lastAirdropAt[token] == 0;
    }

    function _pot(address token, Currency quote) private view returns (uint256) {
        if (_uninitialized(token)) return 0;
        if (Currency.unwrap(quoteOf[token]) == Currency.unwrap(quote)) return reserve[token];
        return reserveByQuote[token][quote.toId()];
    }

    function _addPot(address token, Currency quote, uint256 amount) private {
        if (_uninitialized(token) || Currency.unwrap(quoteOf[token]) == Currency.unwrap(quote)) {
            if (Currency.unwrap(quoteOf[token]) == address(0) && Currency.unwrap(quote) != address(0)) {
                quoteOf[token] = quote;
            }
            reserve[token] += amount;
            return;
        }
        reserveByQuote[token][quote.toId()] += amount;
    }

    function _subPot(address token, Currency quote, uint256 amount) private {
        if (Currency.unwrap(quoteOf[token]) == Currency.unwrap(quote)) {
            reserve[token] -= amount;
        } else {
            reserveByQuote[token][quote.toId()] -= amount;
        }
    }

    function _lastAt(address token, Currency quote) private view returns (uint64 last) {
        last = lastAirdropAtQuote[token][quote.toId()];
        if (last == 0 && Currency.unwrap(quote) == Currency.unwrap(quoteOf[token])) {
            last = lastAirdropAt[token];
        }
    }

    function _secondsUntil(uint64 last, uint32 epoch) private view returns (uint256) {
        if (last == 0) return 0;
        if (epoch == 0) epoch = ProtocolConstants.DEFAULT_HOLDER_AIRDROP_EPOCH_SECONDS;
        uint256 next = uint256(last) + epoch;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    function _finishEpoch(address token, Currency quote, PendingAirdrop storage pending, uint256 holdersLen) private {
        emit Airdropped(token, quote, pending.pot, pending.paid, holdersLen, msg.sender);
        delete _pending[token][quote.toId()];
        lastAirdropAtQuote[token][quote.toId()] = uint64(block.timestamp);
        if (Currency.unwrap(quoteOf[token]) == Currency.unwrap(quote)) {
            lastAirdropAt[token] = uint64(block.timestamp);
        }
    }

    function _materializeQuote(Currency quote, uint256 amount) private {
        if (amount == 0 || address(claimsManager) == address(0)) return;
        uint256 claims = claimsManager.balanceOf(address(this), quote.toId());
        if (claims == 0) return;
        uint256 pull = claims < amount ? claims : amount;
        _redeemClaims(quote, address(this), pull);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
